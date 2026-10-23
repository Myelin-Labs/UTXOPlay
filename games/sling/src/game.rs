use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const ID: &str = "myelin-sling";
pub const PORT: u16 = 8782;
pub const MAX_ACTIONS: u64 = 1000;
pub const LEVELS: u32 = 12;
const SCALE: i64 = 1000;
const GROUND: i64 = 480 * SCALE;
const RADIUS: i64 = 16 * SCALE;
const STOCK_LIMIT: u32 = 3;
const EXTRA_LIMIT: u32 = 3;
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Item {
    Burst,
    Pierce,
    Extra,
}
impl Item {
    fn index(self) -> usize {
        match self {
            Self::Burst => 0,
            Self::Pierce => 1,
            Self::Extra => 2,
        }
    }
    fn price(self) -> u32 {
        match self {
            Self::Burst => 12,
            Self::Pierce => 10,
            Self::Extra => 8,
        }
    }
    fn id(self) -> &'static str {
        match self {
            Self::Burst => "burst",
            Self::Pierce => "pierce",
            Self::Extra => "extra",
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Target {
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
    pub kind: String,
    pub hp: i64,
}
#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Power {
    #[default]
    Normal,
    Burst,
    Pierce,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
enum Action {
    Next {},
    Retry {},
    Extra {},
    Buy {
        item: Item,
    },
    Launch {
        dx: i64,
        dy: i64,
        #[serde(default)]
        power: Power,
    },
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    pub level: u32,
    pub shots: u32,
    pub score: u32,
    pub level_start_score: u32,
    pub targets: Vec<Target>,
    pub trace: Vec<[i64; 2]>,
    pub hits: Vec<[i64; 3]>,
    pub world_trace: Vec<Vec<i64>>,
    pub inventory: [u32; 3],
    pub last_power: Power,
    pub coins: u32,
    pub coins_earned: u32,
    pub coins_spent: u32,
    pub extra_used: u32,
    pub rewarded_targets: Vec<bool>,
}
impl Default for Game {
    fn default() -> Self {
        Self::level(1, 0)
    }
}
impl Game {
    fn level(level: u32, score: u32) -> Self {
        let mut targets = vec![];
        let mut add = |x, y, w, h, kind: &str, hp| {
            targets.push(Target {
                x: x * SCALE,
                y: y * SCALE,
                w: w * SCALE,
                h: h * SCALE,
                kind: kind.into(),
                hp,
            });
        };
        if level <= 3 {
            let offset = (level as i64 - 1) * 36;
            add(670 + offset, 390, 24, 90, "wood", 1);
            add(782 + offset, 390, 24, 90, "wood", 1);
            add(657 + offset, 368, 162, 22, "wood", 1);
            add(710 + offset, 422, 42, 58, "sprite", 1);
            add(709 + offset, 311, 42, 57, "sprite", 1);
            if level >= 2 {
                add(872 + offset, 416, 40, 64, "sprite", 1);
                add(852 + offset, 388, 20, 92, "stone", 2);
            }
            if level == 3 {
                add(690 + offset, 250, 24, 60, "wood", 1);
                add(764 + offset, 250, 24, 60, "wood", 1);
                add(688 + offset, 230, 104, 20, "wood", 1);
                add(727 + offset, 177, 42, 53, "sprite", 1);
            }
        } else {
            // Each island has an authored arrangement: (left, height, stone pillars).
            let towers: &[(i64, i64, bool)] = match level {
                4 => &[(560, 72, false), (820, 112, false)],
                5 => &[(600, 140, true), (850, 64, false)],
                6 => &[(530, 66, false), (710, 130, false), (900, 66, false)],
                7 => &[(570, 160, false), (840, 110, true)],
                8 => &[(520, 100, true), (710, 160, false), (900, 70, false)],
                9 => &[(560, 190, true), (830, 150, false)],
                10 => &[(510, 60, false), (700, 120, true), (900, 190, false)],
                11 => &[(520, 170, true), (720, 80, false), (900, 170, true)],
                _ => &[(510, 110, true), (710, 210, true), (910, 130, true)],
            };
            for &(x, height, stone) in towers {
                let kind = if stone { "stone" } else { "wood" };
                let hp = if stone { 2 } else { 1 };
                add(x, 480 - height, 20, height, kind, hp);
                add(x + 90, 480 - height, 20, height, kind, hp);
                add(x - 8, 460 - height, 126, 20, "wood", 1);
                add(x + 34, 408 - height, 42, 52, "sprite", 1);
                if height >= 130 {
                    add(x + 34, 428, 42, 52, "sprite", 1);
                }
            }
        }
        Self {
            level,
            shots: 4,
            score,
            level_start_score: score,
            rewarded_targets: vec![false; targets.len()],
            targets,
            trace: vec![],
            hits: vec![],
            world_trace: vec![],
            inventory: [1, 1, 1],
            last_power: Power::Normal,
            coins: 0,
            coins_earned: 0,
            coins_spent: 0,
            extra_used: 0,
        }
    }
    fn remaining(&self) -> usize {
        self.targets
            .iter()
            .filter(|t| t.kind == "sprite" && t.hp > 0)
            .count()
    }
    fn enter_level(&mut self, level: u32, score: u32, retry: bool) {
        let mut next = Self::level(level, score);
        next.coins = self.coins;
        next.coins_earned = self.coins_earned;
        next.coins_spent = self.coins_spent;
        next.inventory = self.inventory.map(|count| count.max(1));
        if retry {
            next.rewarded_targets.clone_from(&self.rewarded_targets);
        }
        *self = next;
    }
    fn buy_error(&self, item: Item) -> Option<&'static str> {
        if self.remaining() == 0 {
            return Some("Continue to the next island first");
        }
        if self.shots == 0 && item.index() != 2 {
            return Some("Retry this island before equipping a flight power");
        }
        if item.index() == 2 && self.extra_used >= EXTRA_LIMIT {
            return Some("Extra-flight limit reached on this attempt");
        }
        if self.inventory[item.index()] >= STOCK_LIMIT {
            return Some("Satchel slot is full");
        }
        if self.coins < item.price() {
            return Some("Play to earn more coins");
        }
        None
    }
    pub fn apply(&mut self, a: &Value) -> Result<(), String> {
        let action: Action = serde_json::from_value(a.clone()).map_err(|e| e.to_string())?;
        let (dx, dy, power) = match action {
            Action::Next {} if self.remaining() == 0 && self.level < LEVELS => {
                self.enter_level(self.level + 1, self.score, false);
                return Ok(());
            }
            Action::Retry {} if self.shots == 0 && self.remaining() > 0 => {
                self.enter_level(self.level, self.level_start_score, true);
                return Ok(());
            }
            Action::Buy { item } => {
                if let Some(reason) = self.buy_error(item) {
                    return Err(reason.into());
                }
                self.coins -= item.price();
                self.coins_spent += item.price();
                self.inventory[item.index()] += 1;
                return Ok(());
            }
            Action::Extra {}
                if self.inventory[2] > 0
                    && self.remaining() > 0
                    && self.extra_used < EXTRA_LIMIT =>
            {
                self.inventory[2] -= 1;
                self.extra_used += 1;
                self.shots += 1;
                return Ok(());
            }
            Action::Launch { dx, dy, power } if self.shots > 0 && self.remaining() > 0 => {
                (dx, dy, power)
            }
            _ => return Err("Action unavailable in the current level".into()),
        };
        if !(-120..=-8).contains(&dx) || !(-20..=100).contains(&dy) || dx * dx + dy * dy > 14400 {
            return Err("Pull must be inside the sling's 120 pixel radius".into());
        }
        let item = match power {
            Power::Burst => Some(0),
            Power::Pierce => Some(1),
            Power::Normal => None,
        };
        if let Some(index) = item {
            if self.inventory[index] == 0 {
                return Err("This item has already been used on this island".into());
            }
            self.inventory[index] -= 1;
        }
        self.last_power = power;
        self.shots -= 1;
        self.trace.clear();
        self.hits.clear();
        self.world_trace.clear();
        let (mut x, mut y) = (180 * SCALE, 360 * SCALE);
        let (mut vx, mut vy) = (-dx * 135, -dy * 135);
        let mut hit = vec![false; self.targets.len()];
        let mut burst = false;
        // 600 fixed microsteps, one half of a 60 Hz frame. All arithmetic is integer.
        for step in 0..600 {
            vy += 110;
            x += vx / 2;
            y += vy / 2;
            self.trace.push([x, y]);
            let mut detonated = false;
            for (i, t) in self.targets.iter_mut().enumerate() {
                if t.hp == 0 || hit[i] {
                    continue;
                }
                let cx = x.clamp(t.x, t.x + t.w);
                let cy = y.clamp(t.y, t.y + t.h);
                if (x - cx).pow(2) + (y - cy).pow(2) <= RADIUS.pow(2) {
                    t.hp = (t.hp - if power == Power::Normal { 1 } else { 2 }).max(0);
                    hit[i] = true;
                    self.hits.push([step, i as i64, t.hp]);
                    if t.hp == 0 {
                        self.score += if t.kind == "sprite" { 500 } else { 100 };
                    }
                    if power == Power::Burst && !burst {
                        detonated = true;
                    }
                    if power != Power::Pierce {
                        vx = vx * 3 / 4;
                        vy -= 1000;
                    }
                }
            }
            if detonated {
                burst = true;
                for (i, t) in self.targets.iter_mut().enumerate() {
                    let cx = x.clamp(t.x, t.x + t.w);
                    let cy = y.clamp(t.y, t.y + t.h);
                    if t.hp > 0
                        && !hit[i]
                        && (x - cx).pow(2) + (y - cy).pow(2) <= (100 * SCALE).pow(2)
                    {
                        t.hp = 0;
                        hit[i] = true;
                        self.hits.push([step, i as i64, 0]);
                        self.score += if t.kind == "sprite" { 500 } else { 100 };
                    }
                }
            }
            // Unsupported objects fall in deterministic array order.
            for i in 0..self.targets.len() {
                if self.targets[i].hp == 0 {
                    continue;
                }
                let t = &self.targets[i];
                let bottom = t.y + t.h;
                let support = self
                    .targets
                    .iter()
                    .enumerate()
                    .filter(|(j, o)| {
                        *j != i && o.hp > 0 && o.y >= bottom && t.x < o.x + o.w && t.x + t.w > o.x
                    })
                    .map(|(_, o)| o.y)
                    .min()
                    .unwrap_or(GROUND);
                let fall = (support - bottom).clamp(0, 2500);
                self.targets[i].y += fall;
                // A long fall is visible and the target remains hittable on the ground.
            }
            self.world_trace
                .push(self.targets.iter().flat_map(|t| [t.y, t.hp]).collect());
            if y + RADIUS >= GROUND {
                y = GROUND - RADIUS;
                vy = -vy * 2 / 5;
                vx = vx * 4 / 5;
            }
            if !(0..=1100 * SCALE).contains(&x) || (step > 120 && vx.abs() < 180 && vy.abs() < 300)
            {
                break;
            }
        }
        let mut earned = 0;
        for (target, rewarded) in self.targets.iter().zip(&mut self.rewarded_targets) {
            if target.hp == 0 && !*rewarded {
                earned += if target.kind == "sprite" { 5 } else { 1 };
                *rewarded = true;
            }
        }
        if self.remaining() == 0 {
            self.score += self.shots * 250;
            earned += 10;
        }
        self.coins += earned;
        self.coins_earned += earned;
        Ok(())
    }
    pub fn view(&self) -> Value {
        let items: Vec<Value> = [Item::Burst, Item::Pierce, Item::Extra].into_iter().map(|item| {
            let (name, description) = match item {
                Item::Burst => ("Bloom bomb", "Explodes on impact, clearing nearby targets."),
                Item::Pierce => ("Star feather", "Pierces stone and wood with two-hit strength."),
                Item::Extra => ("Extra flight", "Adds one flight. Use up to three per island attempt."),
            };
            json!({"id":item.id(),"name":name,"description":description,"price":item.price(),"owned":self.inventory[item.index()],"can_buy":self.buy_error(item).is_none(),"unavailable":self.buy_error(item)})
        }).collect();
        json!({"coins":self.coins,"coins_earned":self.coins_earned,"coins_spent":self.coins_spent,"extra_used":self.extra_used,"extra_limit":EXTRA_LIMIT,"shop":{"stock_limit":STOCK_LIMIT,"items":items},"level":self.level,"total_levels":LEVELS,"level_name":LEVEL_NAMES[(self.level-1) as usize],"region":REGIONS[((self.level-1)/3) as usize],"inventory":{"burst":self.inventory[0],"pierce":self.inventory[1],"extra":self.inventory[2]},"last_power":self.last_power,"shots":self.shots,"score":self.score,"targets":self.targets,"trace":self.trace,"hits":self.hits,"world_trace":self.world_trace,"remaining":self.remaining(),"won":self.remaining()==0,"lost":self.shots==0&&self.remaining()>0,"scale":SCALE})
    }
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=LEVELS).contains(&self.level)
            || self.shots > 4 + EXTRA_LIMIT
            || self.inventory.iter().any(|v| *v > STOCK_LIMIT)
            || self.extra_used > EXTRA_LIMIT
            || self.shots > 4 + self.extra_used
            || self.coins_earned > 10_000
            || self.coins_spent > self.coins_earned
            || self.coins != self.coins_earned - self.coins_spent
            || self.rewarded_targets.len() != self.targets.len()
            || self.trace.len() > 600
            || self.world_trace.len() != self.trace.len()
        {
            Err("Invalid game snapshot".into())
        } else {
            Ok(())
        }
    }
}
const LEVEL_NAMES: [&str; 12] = [
    "First flight",
    "Stone & sky",
    "The high garden",
    "Twin meadows",
    "Mossy gate",
    "Stepping stones",
    "Cloud lookout",
    "Crystal crossing",
    "The old citadel",
    "Starlight stairs",
    "Moonlit orchard",
    "Crown of the sky",
];
const REGIONS: [&str; 4] = [
    "Morning gardens",
    "Amber meadows",
    "Cloud citadel",
    "Starlight summit",
];
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shop_rejects_forged_price_and_unfunded_purchase_atomically() {
        let mut g = Game::default();
        let before = g.view();
        for action in [
            json!({"type":"buy","item":"burst"}),
            json!({"type":"buy","item":"burst","price":0}),
            json!({"type":"buy","item":"coins"}),
            json!({"type":"buy","item":"extra","quantity":100}),
        ] {
            assert!(g.apply(&action).is_err());
            assert_eq!(g.view(), before);
        }
        g.apply(&json!({"type":"launch","dx":-116,"dy":16}))
            .unwrap();
        assert_eq!(g.remaining(), 0);
        assert!(g.coins >= 12);
        assert_eq!(g.coins, g.coins_earned);
        g.apply(&json!({"type":"next"})).unwrap();
        let balance = g.coins;
        g.apply(&json!({"type":"buy","item":"burst"})).unwrap();
        assert_eq!(g.coins, balance - 12);
        assert_eq!(g.coins_spent, 12);
        assert_eq!(g.inventory[0], 2);
        g.validate().unwrap();
        let mut replay: Game = serde_json::from_slice(&serde_json::to_vec(&g).unwrap()).unwrap();
        for game in [&mut g, &mut replay] {
            game.apply(&json!({"type":"launch","dx":-8,"dy":0,"power":"burst"}))
                .unwrap();
        }
        assert_eq!(g.view(), replay.view());
    }
    #[test]
    fn retry_cannot_farm_coins_and_preserves_unspent_stock() {
        let mut g = Game::default();
        let mut chosen = None;
        for dx in (-116..=-28).step_by(4) {
            for dy in (-16..=96).step_by(4) {
                let mut candidate = g.clone();
                if candidate
                    .apply(&json!({"type":"launch","dx":dx,"dy":dy}))
                    .is_ok()
                    && candidate.coins > 0
                    && candidate.remaining() > 0
                {
                    chosen = Some((dx, dy, candidate));
                    break;
                }
            }
            if chosen.is_some() {
                break;
            }
        }
        let (dx, dy, next) = chosen.expect("partial target hit");
        g = next;
        let earned = g.coins_earned;
        while g.shots > 0 {
            g.apply(&json!({"type":"launch","dx":-8,"dy":0})).unwrap();
        }
        g.apply(&json!({"type":"retry"})).unwrap();
        g.apply(&json!({"type":"launch","dx":dx,"dy":dy})).unwrap();
        assert_eq!(
            g.coins_earned, earned,
            "same targets cannot pay twice after retry"
        );
        g.inventory[0] = 3;
        g.shots = 0;
        g.apply(&json!({"type":"retry"})).unwrap();
        assert_eq!(g.inventory[0], 3);
        g.validate().unwrap();
    }
    #[test]
    fn stock_and_extra_flight_limits_fail_without_deducting_coins() {
        let mut g = Game {
            coins: 100,
            coins_earned: 100,
            ..Game::default()
        };
        for _ in 0..2 {
            g.apply(&json!({"type":"buy","item":"extra"})).unwrap();
        }
        let full = g.view();
        assert!(g.apply(&json!({"type":"buy","item":"extra"})).is_err());
        assert_eq!(full, g.view());
        for _ in 0..3 {
            g.apply(&json!({"type":"extra"})).unwrap();
        }
        assert_eq!(g.shots, 7);
        let capped = g.view();
        assert!(g.apply(&json!({"type":"buy","item":"extra"})).is_err());
        assert_eq!(capped, g.view());
        g.validate().unwrap();
        let mut invalid = g.clone();
        invalid.coins += 1;
        assert!(invalid.validate().is_err());
        invalid = g.clone();
        invalid.rewarded_targets.pop();
        assert!(invalid.validate().is_err());
    }
    #[test]
    fn deterministic_and_bounded() {
        let mut a = Game::default();
        let mut b = a.clone();
        let action = json!({"type":"launch","dx":-96,"dy":48});
        a.apply(&action).unwrap();
        b.apply(&action).unwrap();
        assert_eq!(a.view(), b.view());
        assert_eq!(a.shots, 3);
        assert!(a.trace.len() <= 600);
        assert!(a
            .apply(&json!({"type":"launch","dx":-999999999999i64,"dy":0}))
            .is_err());
        assert!(a
            .apply(&json!({"type":"launch","dx":-50.5,"dy":0}))
            .is_err());
    }
    #[test]
    fn snapshot_replays_next_shot() {
        let mut a = Game::default();
        a.apply(&json!({"type":"launch","dx":-90,"dy":45})).unwrap();
        let mut b: Game = serde_json::from_slice(&serde_json::to_vec(&a).unwrap()).unwrap();
        let act = json!({"type":"launch","dx":-80,"dy":30});
        a.apply(&act).unwrap();
        b.apply(&act).unwrap();
        assert_eq!(a.view(), b.view());
    }
    #[test]
    fn all_twelve_islands_are_winnable_without_items() {
        let mut game = Game::default();
        for level in 1..=LEVELS {
            for _ in 0..4 {
                if game.remaining() == 0 {
                    break;
                }
                let mut best: Option<(i64, Game, i64, i64)> = None;
                for dx in (-116..=-28).step_by(4) {
                    for dy in (-16..=96).step_by(4) {
                        let mut candidate = game.clone();
                        if candidate
                            .apply(&json!({"type":"launch","dx":dx,"dy":dy}))
                            .is_ok()
                        {
                            let utility = -(candidate.remaining() as i64) * 10000
                                + candidate.score as i64
                                + candidate.hits.len() as i64 * 10;
                            if best.as_ref().is_none_or(|v| utility > v.0) {
                                best = Some((utility, candidate, dx, dy));
                            }
                        }
                    }
                }
                let (_, next, dx, dy) = best.unwrap();
                println!("level {level}: pull {dx}, {dy}");
                game = next;
            }
            assert_eq!(
                game.remaining(),
                0,
                "level {level} must be winnable in four shots"
            );
            if level < LEVELS {
                game.apply(&json!({"type":"next"})).unwrap();
            }
        }
    }
    #[test]
    fn inventory_is_atomic_and_refills_on_retry_or_next() {
        let mut g = Game::default();
        let before = g.view();
        for bad in [
            json!({"type":"launch","dx":-900,"dy":30,"power":"burst"}),
            json!({"type":"launch","dx":-8,"dy":0,"power":"unknown"}),
            json!({"type":"extra","count":500}),
        ] {
            assert!(g.apply(&bad).is_err());
            assert_eq!(g.view(), before);
        }
        g.apply(&json!({"type":"extra"})).unwrap();
        assert_eq!(g.shots, 5);
        assert!(g.apply(&json!({"type":"extra"})).is_err());
        g.apply(&json!({"type":"launch","dx":-8,"dy":0,"power":"burst"}))
            .unwrap();
        let used = g.view();
        assert_eq!(g.inventory, [0, 1, 0]);
        assert!(g
            .apply(&json!({"type":"launch","dx":-8,"dy":0,"power":"burst"}))
            .is_err());
        assert_eq!(g.view(), used);
        g.shots = 0;
        g.apply(&json!({"type":"retry"})).unwrap();
        assert_eq!(g.inventory, [1, 1, 1]);
        assert_eq!(g.score, g.level_start_score);
        g.shots = 0;
        g.apply(&json!({"type":"extra"})).unwrap();
        assert_eq!(g.shots, 1); // Rescue is allowed after the fourth miss.
        for t in &mut g.targets {
            t.hp = 0;
        }
        assert!(g.apply(&json!({"type":"extra"})).is_err());
        g.apply(&json!({"type":"next"})).unwrap();
        assert_eq!(g.level, 2);
        assert_eq!(g.inventory, [1, 1, 1]);
    }
    #[test]
    fn powered_hits_change_physics_and_replay_exactly() {
        for power in ["burst", "pierce"] {
            let mut g = Game {
                targets: vec![
                    Target {
                        x: 330 * SCALE,
                        y: 0,
                        w: 20 * SCALE,
                        h: GROUND,
                        kind: "stone".into(),
                        hp: 2,
                    },
                    Target {
                        x: 390 * SCALE,
                        y: 300 * SCALE,
                        w: 42 * SCALE,
                        h: GROUND - 300 * SCALE,
                        kind: "sprite".into(),
                        hp: 1,
                    },
                ],
                rewarded_targets: vec![false; 2],
                ..Game::default()
            };
            let mut normal = g.clone();
            normal
                .apply(&json!({"type":"launch","dx":-100,"dy":0}))
                .unwrap();
            let mut replay: Game =
                serde_json::from_slice(&serde_json::to_vec(&g).unwrap()).unwrap();
            let action = json!({"type":"launch","dx":-100,"dy":0,"power":power});
            g.apply(&action).unwrap();
            replay.apply(&action).unwrap();
            assert_eq!(g.view(), replay.view());
            assert_eq!(normal.targets[0].hp, 1);
            assert_eq!(g.targets[0].hp, 0);
            assert_eq!(g.targets[1].hp, 0);
            if power == "burst" {
                assert_eq!(g.hits[0][0], g.hits[1][0]);
            } else {
                assert!(g.hits[1][0] > g.hits[0][0]);
            }
        }
    }
    #[test]
    fn levels_are_distinct_and_inside_the_playfield() {
        let mut layouts = std::collections::HashSet::new();
        for level in 1..=LEVELS {
            let g = Game::level(level, 0);
            assert!(layouts.insert(serde_json::to_string(&g.targets).unwrap()));
            assert!(g
                .targets
                .iter()
                .all(|t| t.x >= 0 && t.y >= 0 && t.x + t.w <= 1100 * SCALE && t.y + t.h <= GROUND));
            g.validate().unwrap();
        }
        let mut final_level = Game::level(LEVELS, 0);
        for t in &mut final_level.targets {
            t.hp = 0;
        }
        assert!(final_level.apply(&json!({"type":"next"})).is_err());
    }
    #[test]
    fn can_hit_targets() {
        let mut best = 0;
        for dx in (-118..=-40).step_by(4) {
            for dy in (0..=80).step_by(4) {
                let mut g = Game::default();
                if g.apply(&json!({"type":"launch","dx":dx,"dy":dy})).is_ok() {
                    best = best.max(g.score);
                }
            }
        }
        assert!(best >= 500, "at least one target must be reachable");
    }
}
