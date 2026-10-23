//! Original deterministic Gold Miner rules; all rewards and purchases execute here.
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub const ID: &str = "myelin-neon-miner";
pub const PORT: u16 = 8786;
pub const MAX_ACTIONS: u64 = 6000;
pub const MAX_TICKS: u32 = 90000;
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
    pub stock: [u32; 3],
    pub boost: u32,
    pub lens: u32,
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
impl Game {
    pub fn new(kind: Kind) -> Self {
        let mut g = Self {
            kind,
            tick: 0,
            level: 1,
            score: 0,
            level_score: 0,
            goal: 350,
            coins: 0,
            earned: 0,
            spent: 0,
            lives: 3,
            mode: "mining".into(),
            over: false,
            time: 1800,
            phase: 0,
            angle: 35,
            dir: 1,
            length: 36,
            cargo: -1,
            rng: 92017,
            previous: 0,
            stock: [1, 0, 0],
            boost: 0,
            lens: 0,
            time_used: 0,
            ores: vec![],
        };
        g.populate();
        g
    }
    fn rand(&mut self) -> u32 {
        self.rng = (u64::from(self.rng) * 16807 % 2147483647) as u32;
        self.rng
    }
    fn populate(&mut self) {
        self.rng = 92017 + self.level * 104729;
        let mut types = [0, 1, 2, 3, 0, 1, 0, 4, 1, 3, 2, 0, 5, 3, 1];
        for n in (1..types.len()).rev() {
            let j = self.rand() as usize % (n + 1);
            types.swap(n, j);
        }
        self.ores.clear();
        for (n, kind) in types.into_iter().enumerate() {
            let x = 120 + (n as i32 % 5) * 190 + (self.rand() % 61) as i32 - 30;
            let y = 260 + (n as i32 / 5) * 140 + (self.rand() % 41) as i32 - 20;
            let (value, weight, radius) = match kind {
                0 => (80, 2, 24),
                1 => (200, 5, 38),
                2 => (260, 1, 21),
                3 => (15, 7, 33),
                4 => (110, 2, 24),
                _ => (90 + self.rand() % 151, 3, 27),
            };
            self.ores.push(Ore { x, y, radius, kind, value, weight, taken: false });
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
            || !(1..=20).contains(&self.level)
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
            || self.cargo >= 15
            || self.ores.len() != 15
            || self.rng == 0
            || self.rng >= 2147483647
            || self.previous > 15
            || self.stock.iter().any(|v| *v > 3)
            || self.boost > 450
            || self.lens > 3
            || self.time_used > 2
            || !["mining", "cleared", "lost", "complete"].contains(&self.mode.as_str())
        {
            return Err("Invalid miner snapshot".into());
        }
        if self.ores.iter().any(|o| {
            o.kind > 5
                || o.x < 60
                || o.x > 940
                || o.y < 220
                || o.y > 600
                || o.radius < 20
                || o.radius > 40
                || o.weight < 1
                || o.weight > 7
                || o.value > 300
        }) {
            return Err("Invalid ore".into());
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
                if inputs.is_empty() || inputs.len() > 60 || inputs.iter().any(|i| *i > 15) || self.mode != "mining" || self.over {
                    return Err("Invalid tape or inactive sector".into());
                }
                for i in inputs {
                    self.step(i)
                }
            }
            Action::Buy { item } => self.buy(&item)?,
            Action::Next => {
                if self.mode != "cleared" || self.level >= 20 {
                    return Err("Clear this sector first".into());
                }
                self.level += 1;
                self.level_score = 0;
                self.goal = 350 + (self.level - 1) * 30;
                self.time = 1800;
                self.time_used = 0;
                self.boost = 0;
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
                self.time = 1800;
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
        let (slot, price) = match item {
            "emp" => (0, 8),
            "overdrive" => (1, 18),
            "time-cell" => (2, 15),
            "lens" => (3, 30 * (self.lens + 1)),
            _ => return Err("Unknown item".into()),
        };
        if (slot < 3 && self.stock[slot] >= 3) || (slot == 3 && self.lens >= 3) {
            return Err("Upgrade or stock limit reached".into());
        }
        if self.coins < price {
            return Err("Mine more credits first".into());
        }
        self.coins -= price;
        self.spent += price;
        if slot == 3 {
            self.lens += 1
        } else {
            self.stock[slot] += 1
        }
        Ok(())
    }
    pub fn step(&mut self, input: u8) {
        if self.mode != "mining" || self.over {
            return;
        }
        self.tick += 1;
        self.time = self.time.saturating_sub(1);
        let pressed = input & !self.previous;
        self.previous = input;
        if self.boost > 0 {
            self.boost -= 1;
        }
        if pressed & 2 != 0 && self.phase == 2 && self.cargo >= 0 && self.stock[0] > 0 {
            self.stock[0] -= 1;
            self.cargo = -1;
        }
        if pressed & 4 != 0 && self.boost == 0 && self.stock[1] > 0 {
            self.stock[1] -= 1;
            self.boost = 450;
        }
        if pressed & 8 != 0 && self.time_used < 2 && self.stock[2] > 0 {
            self.stock[2] -= 1;
            self.time_used += 1;
            self.time = (self.time + 300).min(2400);
        }
        match self.phase {
            0 => {
                if pressed & 1 != 0 {
                    self.phase = 1;
                } else if self.tick.is_multiple_of(2) {
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
                        o.taken = true;
                        self.cargo = n as i32;
                        self.phase = 2;
                        break;
                    }
                }
                if !(25..=975).contains(&x) || y >= 650 || self.length >= 950 {
                    self.phase = 2;
                }
            }
            2 => {
                let speed = if self.cargo < 0 { 22 } else { (18 / self.ores[self.cargo as usize].weight).max(3) };
                self.length = (self.length - speed * if self.boost > 0 { 2 } else { 1 }).max(36);
                if self.length == 36 {
                    if self.cargo >= 0 {
                        let o = &self.ores[self.cargo as usize];
                        let value = if o.kind == 2 { o.value * (100 + 20 * self.lens) / 100 } else { o.value };
                        let battery = o.kind == 4;
                        self.score += value;
                        self.level_score += value;
                        self.reward(value / 10);
                        if battery {
                            self.time = (self.time + 90).min(2400);
                        }
                    }
                    self.cargo = -1;
                    self.phase = 0;
                    if self.level_score >= self.goal {
                        self.reward(15);
                        self.mode = if self.level == 20 { "complete" } else { "cleared" }.into();
                        self.over = self.level == 20;
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
    fn twenty_sectors_are_winnable_without_purchases() {
        let mut g = Game::new(Kind::NeonMiner);
        let actions: Vec<Value> = serde_json::from_str(include_str!("../../../tests/neon-miner-solutions.json")).unwrap();
        for action in actions {
            g.apply(&action).unwrap();
        }
        assert_eq!(g.level, 20);
        assert_eq!(g.mode, "complete");
        assert_eq!(g.lives, 3);
        assert_eq!(g.coins, g.earned);
        assert_eq!(g.spent, 0);
    }
    #[test]
    fn shop_rejects_forgery_limits_and_insufficient_credits() {
        let mut g = Game::new(Kind::NeonMiner);
        let before = g.clone();
        for a in [
            json!({"type":"buy","item":"emp"}),
            json!({"type":"buy","item":"emp","price":0}),
            json!({"type":"buy","item":"emp","quantity":10}),
            json!({"type":"buy","item":"bad"}),
            json!({"type":"ticks","inputs":[16]}),
            json!({"type":"next"}),
        ] {
            assert!(g.apply(&a).is_err());
            assert_eq!(g, before);
        }
        g.reward(500);
        for _ in 0..2 {
            g.apply(&json!({"type":"buy","item":"emp"})).unwrap();
        }
        assert_eq!(g.stock[0], 3);
        assert_eq!(g.coins, 484);
        assert_eq!(g.spent, 16);
        let before = g.clone();
        assert!(g.apply(&json!({"type":"buy","item":"emp"})).is_err());
        assert_eq!(g, before);
        for _ in 0..3 {
            g.apply(&json!({"type":"buy","item":"lens"})).unwrap();
        }
        assert_eq!(g.lens, 3);
        assert_eq!(g.spent, 196);
        assert!(g.apply(&json!({"type":"buy","item":"lens"})).is_err());
    }
    #[test]
    fn power_items_only_consume_when_eligible_and_once_per_press() {
        let mut g = Game::new(Kind::NeonMiner);
        g.stock = [3, 3, 3];
        g.time = 1000;
        g.step(14);
        assert_eq!(g.stock, [3, 2, 2]);
        assert_eq!(g.time_used, 1);
        assert_eq!(g.boost, 450);
        g.step(14);
        assert_eq!(g.stock, [3, 2, 2]);
        g.step(0);
        g.step(8);
        g.step(0);
        g.step(8);
        assert_eq!(g.stock[2], 1);
        assert_eq!(g.time_used, 2);
        g.phase = 2;
        g.cargo = 0;
        g.ores[0].taken = true;
        g.length = 500;
        g.step(0);
        g.step(2);
        assert_eq!(g.stock[0], 2);
        assert_eq!(g.cargo, -1);
        assert_eq!(g.coins, 0);
        assert!(g.ores[0].taken);
    }
    #[test]
    fn retry_does_not_respawn_ore_or_duplicate_earnings() {
        let mut g = Game::new(Kind::NeonMiner);
        g.ores[2].taken = true;
        g.score = 260;
        g.level_score = 260;
        g.reward(26);
        g.time = 1;
        g.step(0);
        assert_eq!(g.mode, "lost");
        g.apply(&json!({"type":"retry"})).unwrap();
        assert!(g.ores[2].taken);
        assert_eq!(g.level_score, 260);
        assert_eq!(g.coins, 26);
        assert_eq!(g.lives, 2);
        assert_eq!(g.time, 1800);
    }
    #[test]
    fn corrupted_snapshot_and_unknown_actions_fail_closed() {
        let g = Game::new(Kind::NeonMiner);
        let mut bad = g.clone();
        bad.coins = 1;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.cargo = 999;
        assert!(bad.validate().is_err());
        bad = g.clone();
        bad.angle = -1;
        assert!(bad.validate().is_err());
        bad = g.clone();
        assert!(bad.apply(&json!({"type":"award","coins":1000})).is_err());
        assert!(bad.apply(&json!({"type":"ticks","inputs":[]})).is_err());
        assert!(bad.apply(&json!({"type":"ticks","inputs":vec![0;61]})).is_err());
    }
}
