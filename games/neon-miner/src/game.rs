//! Deterministic deep-sector mining. Rewards, contracts and purchases execute here.
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub const ID: &str = "myelin-neon-miner";
pub const PORT: u16 = 8786;
pub const MAX_ACTIONS: u64 = 10000;
pub const MAX_TICKS: u32 = 200000;
pub const SECTORS: u32 = 60;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    NeonMiner,
}
impl Kind {
    pub fn parse(s: &str) -> Result<Self, String> {
        serde_json::from_value(Value::String(s.into())).map_err(|_| "Unknown game".into())
    }
    pub fn id(self) -> &'static str {
        "neon-miner"
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ore {
    pub x: i32,
    pub y: i32,
    pub radius: i32,
    pub kind: u8,
    pub value: u32,
    pub weight: i32,
    pub taken: bool,
    pub anchor: i32,
    pub vx: i32,
    pub armor: u32,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    pub kind: Kind,
    pub tick: u32,
    pub level: u32,
    pub score: u32,
    pub level_score: u32,
    pub goal: u32,
    pub coins: u32,
    pub earned: u32,
    pub spent: u32,
    pub lives: u32,
    pub mode: String,
    pub over: bool,
    pub time: u32,
    pub phase: u8,
    pub angle: i32,
    pub dir: i32,
    pub length: i32,
    pub cargo: i32,
    pub rng: u32,
    pub previous: u8,
    pub stock: [u32; 4],
    pub boost: u32,
    pub lens: u32,
    pub winch: u32,
    pub stasis: u32,
    pub combo: u32,
    pub collected: [u32; 8],
    pub time_used: u32,
    pub ores: Vec<Ore>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case", deny_unknown_fields)]
enum Action {
    Ticks { inputs: Vec<u8> },
    Buy { item: String },
    Next,
    Retry,
}
fn sector_time(level: u32) -> u32 {
    1800 - 750.min((level - 1) * 13)
}
fn sector_goal(level: u32) -> u32 {
    (380 + (level - 1) * 32 + (level - 1) / 15 * 100) * [100, 85, 65, 85, 85][((level - 1) % 5) as usize] / 100
}
impl Game {
    pub fn new(kind: Kind) -> Self {
        let mut g = Self {
            kind,
            tick: 0,
            level: 1,
            score: 0,
            level_score: 0,
            goal: sector_goal(1),
            coins: 0,
            earned: 0,
            spent: 0,
            lives: 3,
            mode: "mining".into(),
            over: false,
            time: sector_time(1),
            phase: 0,
            angle: 35,
            dir: 1,
            length: 36,
            cargo: -1,
            rng: 92017,
            previous: 0,
            stock: [1, 0, 0, 0],
            boost: 0,
            lens: 0,
            winch: 0,
            stasis: 0,
            combo: 0,
            collected: [0; 8],
            time_used: 0,
            ores: vec![],
        };
        g.populate();
        g
    }
    fn tier(&self) -> u32 {
        (self.level - 1) / 15
    }
    fn time_limit(&self) -> u32 {
        if self.level > 30 {
            1
        } else {
            2
        }
    }
    fn contract_done(&self) -> bool {
        let t = self.tier();
        match (self.level - 1) % 5 {
            0 => true,
            1 => self.collected[2] >= 2 + u32::from(t > 1),
            2 => self.collected[3] >= 2 + u32::from(t > 1),
            3 => self.collected[4] > u32::from(t > 0),
            _ => self.collected[7] > u32::from(t > 1),
        }
    }
    fn rand(&mut self) -> u32 {
        self.rng = (u64::from(self.rng) * 16807 % 2147483647) as u32;
        self.rng
    }
    fn populate(&mut self) {
        self.rng = 92017 + self.level * 104729;
        let mut types = [0, 1, 2, 3, 0, 1, 2, 4, 1, 3, 2, 0, 5, 3, 1, 4, 7, 7, 6, 0];
        if self.level >= 16 {
            types[19] = 6;
        }
        if self.level >= 31 {
            types[0] = 3;
        }
        if self.level >= 46 {
            types[8] = 6;
        }
        for n in (1..types.len()).rev() {
            let j = self.rand() as usize % (n + 1);
            types.swap(n, j);
        }
        self.ores.clear();
        for (n, kind) in types.into_iter().enumerate() {
            let x = 120 + (n as i32 % 5) * 190 + (self.rand() % 41) as i32 - 20;
            let y = 280 + (n as i32 / 5) * 98 + (self.rand() % 31) as i32 - 15;
            let (value, weight, radius) = match kind {
                0 => (80, 2, 24),
                1 => (200, 5, 36),
                2 => (260, 1, 21),
                3 => (40, 7, 30),
                4 => (110, 2, 24),
                5 => (90 + self.rand() % 151, 3, 27),
                6 => (0, 4, 26),
                _ => (420, 6, 32),
            };
            self.ores.push(Ore {
                x,
                y,
                radius,
                kind,
                value,
                weight,
                taken: false,
                anchor: x,
                vx: if self.level >= 11 && n % 3 == 0 { (if n % 2 == 1 { -1 } else { 1 }) * (1 + self.tier() as i32 / 2) } else { 0 },
                armor: if kind == 7 { 1 + self.tier() / 2 } else { 0 },
            });
        }
    }
    pub fn tip(&self) -> (i32, i32) {
        let d = DIRECTIONS[self.angle as usize];
        (500 + d[0] * self.length / 1000, 100 + d[1] * self.length / 1000)
    }
    fn reward(&mut self, coins: u32) {
        self.coins += coins;
        self.earned += coins;
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.tick > MAX_TICKS
            || !(1..=SECTORS).contains(&self.level)
            || self.score > 1000000
            || self.earned > 1000000
            || self.spent > self.earned
            || self.coins != self.earned - self.spent
            || self.lives > 3
            || self.time > 2400
            || self.phase > 2
            || !(0..=70).contains(&self.angle)
            || ![-1, 1].contains(&self.dir)
            || !(36..=950).contains(&self.length)
            || self.cargo < -1
            || self.cargo >= 20
            || self.ores.len() != 20
            || self.rng == 0
            || self.rng >= 2147483647
            || self.previous > 31
            || self.stock.iter().any(|v| *v > 3)
            || self.boost > 450
            || self.lens > 3
            || self.winch > 3
            || self.stasis > 180
            || self.combo > 5
            || self.time_used > 2
            || self.collected.iter().any(|v| *v > 20)
            || self.collected.iter().sum::<u32>() > 20
            || !["mining", "cleared", "lost", "complete"].contains(&self.mode.as_str())
        {
            return Err("Invalid miner snapshot".into());
        }
        if self.goal != sector_goal(self.level)
            || self.level_score > self.score
            || self.collected[6] != 0
            || self.ores.iter().any(|o| {
                o.kind > 7
                    || o.x < 40
                    || o.x > 960
                    || o.y < 220
                    || o.y > 600
                    || o.radius < 20
                    || o.radius > 40
                    || o.weight < 1
                    || o.weight > 7
                    || o.value > 420
                    || o.anchor < 100
                    || o.anchor > 900
                    || o.vx.unsigned_abs() > 2
                    || o.armor > 2
                    || (o.kind != 7 && o.armor != 0)
            })
        {
            return Err("Invalid ore or contract".into());
        }
        Ok(())
    }
    pub fn view(&self) -> Value {
        serde_json::to_value(self).expect("serializable miner")
    }
    pub fn apply(&mut self, v: &Value) -> Result<(), String> {
        let action: Action = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
        match action {
            Action::Ticks { inputs } => {
                if inputs.is_empty() || inputs.len() > 60 || inputs.iter().any(|i| *i > 31) || self.mode != "mining" || self.over {
                    return Err("Invalid tape or inactive sector".into());
                }
                for i in inputs {
                    self.step(i)
                }
            }
            Action::Buy { item } => self.buy(&item)?,
            Action::Next => {
                if self.mode != "cleared" || self.level >= SECTORS {
                    return Err("Clear this sector first".into());
                }
                self.level += 1;
                self.level_score = 0;
                self.goal = sector_goal(self.level);
                self.time = sector_time(self.level);
                self.time_used = 0;
                self.boost = 0;
                self.stasis = 0;
                self.combo = 0;
                self.collected = [0; 8];
                self.phase = 0;
                self.angle = 35;
                self.dir = 1;
                self.length = 36;
                self.cargo = -1;
                self.previous = 0;
                self.mode = "mining".into();
                self.populate();
            }
            Action::Retry => {
                if self.mode != "lost" || self.lives == 0 || self.tick >= MAX_TICKS {
                    return Err("No recovery charges left".into());
                }
                self.lives -= 1;
                self.time = sector_time(self.level);
                self.mode = "mining".into();
                self.over = false;
                self.previous = 0;
            }
        }
        self.validate()
    }
    fn buy(&mut self, item: &str) -> Result<(), String> {
        if self.over || self.mode == "complete" {
            return Err("Start a new expedition".into());
        }
        let (slot, base) = match item {
            "emp" => (0, 8),
            "overdrive" => (1, 18),
            "time-cell" => (2, 15),
            "stasis" => (3, 20),
            "lens" => (4, 30),
            "winch" => (5, 45),
            _ => return Err("Unknown item".into()),
        };
        let owned = if slot == 4 {
            self.lens
        } else if slot == 5 {
            self.winch
        } else {
            self.stock[slot]
        };
        if owned >= 3 {
            return Err("Upgrade or stock limit reached".into());
        }
        let price = base * if slot >= 4 { owned + 1 } else { 1 + self.tier() * self.tier() };
        if self.coins < price {
            return Err("Mine more credits first".into());
        }
        self.coins -= price;
        self.spent += price;
        if slot == 4 {
            self.lens += 1
        } else if slot == 5 {
            self.winch += 1
        } else {
            self.stock[slot] += 1
        }
        Ok(())
    }
    fn can_discard(&self) -> bool {
        if self.phase != 2 || self.cargo < 0 || self.stock[0] == 0 {
            return false;
        }
        let t = self.tier();
        let (kind, need) = match (self.level - 1) % 5 {
            0 => return true,
            1 => (2, 2 + u32::from(t > 1)),
            2 => (3, 2 + u32::from(t > 1)),
            3 => (4, 1 + u32::from(t > 0)),
            _ => (7, 1 + u32::from(t > 1)),
        };
        self.ores[self.cargo as usize].kind != kind
            || self.collected[kind as usize] + self.ores.iter().filter(|o| !o.taken && o.kind == kind).count() as u32 >= need
    }
    pub fn step(&mut self, input: u8) {
        if self.mode != "mining" || self.over {
            return;
        }
        self.tick += 1;
        self.time = self.time.saturating_sub(1);
        let pressed = input & !self.previous;
        self.previous = input;
        self.boost = self.boost.saturating_sub(1);
        self.stasis = self.stasis.saturating_sub(1);
        if pressed & 2 != 0 && self.can_discard() {
            self.stock[0] -= 1;
            self.cargo = -1;
            self.combo = 0;
        }
        if pressed & 4 != 0 && self.boost == 0 && self.stock[1] > 0 {
            self.stock[1] -= 1;
            self.boost = 450;
        }
        if pressed & 8 != 0 && self.time_used < self.time_limit() && self.stock[2] > 0 {
            self.stock[2] -= 1;
            self.time_used += 1;
            self.time = (self.time + 300).min(2400);
        }
        if pressed & 16 != 0 && self.stasis == 0 && self.stock[3] > 0 {
            self.stock[3] -= 1;
            self.stasis = 180;
        }
        let range = 25 + self.tier() as i32 * 8;
        if self.stasis == 0 && self.tick.is_multiple_of(2) {
            for o in &mut self.ores {
                if !o.taken && o.vx != 0 {
                    o.x += o.vx;
                    if o.x >= o.anchor + range || o.x <= o.anchor - range {
                        o.vx = -o.vx;
                    }
                }
            }
        }
        match self.phase {
            0 => {
                if pressed & 1 != 0 {
                    self.phase = 1;
                } else if self.tick.is_multiple_of(if self.stasis > 0 {
                    4
                } else if self.level > 30 {
                    1
                } else {
                    2
                }) {
                    self.angle += self.dir;
                    if self.angle >= 70 {
                        self.dir = -1;
                    }
                    if self.angle <= 0 {
                        self.dir = 1;
                    }
                }
            }
            1 => {
                self.length = (self.length + 18).min(950);
                let (x, y) = self.tip();
                for (n, o) in self.ores.iter_mut().enumerate() {
                    if !o.taken && (x - o.x).pow(2) + (y - o.y).pow(2) <= (o.radius + 8).pow(2) {
                        self.phase = 2;
                        if o.armor > 0 {
                            o.armor -= 1;
                        } else {
                            o.taken = true;
                            self.cargo = n as i32;
                        }
                        break;
                    }
                }
                if !(25..=975).contains(&x) || y >= 650 || self.length >= 950 {
                    self.phase = 2;
                }
            }
            2 => {
                let speed =
                    if self.cargo < 0 { 22 } else { ((18 + 4 * self.winch as i32) / self.ores[self.cargo as usize].weight).max(3) };
                self.length = (self.length - speed * if self.boost > 0 { 2 } else { 1 }).max(36);
                if self.length == 36 {
                    if self.cargo >= 0 {
                        let o = &self.ores[self.cargo as usize];
                        let kind = o.kind as usize;
                        if kind == 6 {
                            self.time = self.time.saturating_sub(120 + self.tier() * 30);
                            self.combo = 0;
                        } else {
                            let base = if kind == 2 { o.value * (100 + 20 * self.lens) / 100 } else { o.value };
                            let value = base * (100 + 5 * self.combo.min(5)) / 100;
                            self.score += value;
                            self.level_score += value;
                            self.collected[kind] += 1;
                            self.reward(value / 10);
                            self.combo = (self.combo + 1).min(5);
                            if kind == 4 {
                                self.time = (self.time + 90).min(2400);
                            }
                        }
                    } else {
                        self.combo = 0;
                    }
                    self.cargo = -1;
                    self.phase = 0;
                    if self.level_score >= self.goal && self.contract_done() {
                        self.reward(20 + 5 * self.tier());
                        self.mode = if self.level == SECTORS { "complete" } else { "cleared" }.into();
                        self.over = self.level == SECTORS;
                    }
                }
            }
            _ => unreachable!(),
        }
        if self.mode == "mining" && self.time == 0 {
            self.mode = "lost".into();
            self.over = self.lives == 0;
        }
        if self.tick >= MAX_TICKS {
            self.mode = "lost".into();
            self.over = true;
            self.lives = 0;
        }
    }
}
const DIRECTIONS: [[i32; 2]; 71] = [
    [-940, 342],
    [-927, 375],
    [-914, 407],
    [-899, 438],
    [-883, 469],
    [-866, 500],
    [-848, 530],
    [-829, 559],
    [-809, 588],
    [-788, 616],
    [-766, 643],
    [-743, 669],
    [-719, 695],
    [-695, 719],
    [-669, 743],
    [-643, 766],
    [-616, 788],
    [-588, 809],
    [-559, 829],
    [-530, 848],
    [-500, 866],
    [-469, 883],
    [-438, 899],
    [-407, 914],
    [-375, 927],
    [-342, 940],
    [-309, 951],
    [-276, 961],
    [-242, 970],
    [-208, 978],
    [-174, 985],
    [-139, 990],
    [-105, 995],
    [-70, 998],
    [-35, 999],
    [0, 1000],
    [35, 999],
    [70, 998],
    [105, 995],
    [139, 990],
    [174, 985],
    [208, 978],
    [242, 970],
    [276, 961],
    [309, 951],
    [342, 940],
    [375, 927],
    [407, 914],
    [438, 899],
    [469, 883],
    [500, 866],
    [530, 848],
    [559, 829],
    [588, 809],
    [616, 788],
    [643, 766],
    [669, 743],
    [695, 719],
    [719, 695],
    [743, 669],
    [766, 643],
    [788, 616],
    [809, 588],
    [829, 559],
    [848, 530],
    [866, 500],
    [883, 469],
    [899, 438],
    [914, 407],
    [927, 375],
    [940, 342],
];
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn sixty_sector_campaign_is_replayable() {
        let mut g = Game::new(Kind::NeonMiner);
        let actions: Vec<Value> = serde_json::from_str(include_str!("../../../tests/neon-miner-solutions.json")).unwrap();
        for action in actions {
            g.apply(&action).unwrap();
        }
        assert_eq!(g.level, 60);
        assert_eq!(g.mode, "complete");
        assert_eq!(g.lives, 3);
        assert!(g.spent > 0);
        assert_eq!(g.coins, g.earned - g.spent);
    }
    #[test]
    fn shop_and_tapes_reject_forged_input_without_mutation() {
        let mut g = Game::new(Kind::NeonMiner);
        let before = g.clone();
        for a in [
            json!({"type":"buy","item":"emp"}),
            json!({"type":"buy","item":"emp","price":0}),
            json!({"type":"buy","item":"emp","quantity":5}),
            json!({"type":"buy","item":"unknown"}),
            json!({"type":"ticks","inputs":[32]}),
            json!({"type":"ticks","inputs":[]}),
            json!({"type":"next"}),
        ] {
            assert!(g.apply(&a).is_err());
            assert_eq!(g, before);
        }
        g.reward(1000);
        for _ in 0..3 {
            g.apply(&json!({"type":"buy","item":"winch"})).unwrap();
        }
        assert_eq!(g.winch, 3);
        assert_eq!(g.spent, 270);
        assert!(g.apply(&json!({"type":"buy","item":"winch"})).is_err());
    }
    #[test]
    fn contracts_cannot_be_replaced_by_score() {
        let mut g = Game::new(Kind::NeonMiner);
        g.level = 2;
        g.goal = sector_goal(2);
        g.level_score = 10000;
        g.score = 10000;
        g.phase = 2;
        g.length = 40;
        g.step(0);
        assert_eq!(g.mode, "mining");
        g.collected[2] = 2;
        g.phase = 2;
        g.length = 40;
        g.step(0);
        assert_eq!(g.mode, "cleared");
    }
    #[test]
    fn armor_mines_and_emp_have_distinct_effects() {
        let mut g = Game::new(Kind::NeonMiner);
        for o in &mut g.ores {
            o.taken = true;
        }
        g.ores[0].taken = false;
        g.ores[0].x = 500;
        g.ores[0].y = 280;
        g.ores[0].kind = 7;
        g.ores[0].armor = 2;
        g.phase = 1;
        g.length = 145;
        g.step(0);
        g.step(0);
        assert_eq!(g.ores[0].armor, 1);
        assert!(!g.ores[0].taken);
        assert_eq!(g.cargo, -1);
        assert_eq!(g.score, 0);
        g.ores[0].kind = 6;
        g.ores[0].armor = 0;
        g.ores[0].taken = true;
        g.phase = 2;
        g.cargo = 0;
        g.length = 37;
        g.time = 1000;
        g.step(0);
        assert_eq!(g.time, 879);
        assert_eq!(g.coins, 0);
        g.phase = 2;
        g.cargo = 0;
        g.length = 37;
        g.time = 1000;
        g.step(2);
        assert_eq!(g.time, 999);
        assert_eq!(g.stock[0], 0);
        assert_eq!(g.coins, 0);
    }
    #[test]
    fn stasis_and_time_cells_are_edge_triggered_and_bounded() {
        let mut g = Game::new(Kind::NeonMiner);
        g.level = 31;
        g.stock = [3; 4];
        g.time = 500;
        g.ores[0].vx = 1;
        let x = g.ores[0].x;
        g.step(24);
        g.step(24);
        assert_eq!(g.stock, [3, 3, 2, 2]);
        assert_eq!(g.ores[0].x, x);
        g.step(0);
        g.step(8);
        assert_eq!(g.time_used, 1);
        assert_eq!(g.stock[2], 2);
        assert_eq!(g.stasis, 177);
    }
    #[test]
    fn recovery_preserves_collections_and_armor() {
        let mut g = Game::new(Kind::NeonMiner);
        g.ores[2].taken = true;
        g.ores[3].armor = 0;
        g.collected[2] = 1;
        g.reward(26);
        g.time = 1;
        g.step(0);
        g.apply(&json!({"type":"retry"})).unwrap();
        assert!(g.ores[2].taken);
        assert_eq!(g.collected[2], 1);
        assert_eq!(g.coins, 26);
        assert_eq!(g.lives, 2);
    }
    #[test]
    fn corrupt_snapshots_fail_closed() {
        let g = Game::new(Kind::NeonMiner);
        let mut bad = g.clone();
        bad.coins = 1;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.collected[0] = u32::MAX;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.ores[0].vx = i32::MIN;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.goal = 1;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.cargo = 99;
        assert!(bad.validate().is_err());
    }
}
