//! Deterministic widescreen crystal campaign; no client-supplied rewards or state.
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub const ID: &str = "myelin-prism-breaker";
pub const PORT: u16 = 8787;
pub const MAX_ACTIONS: u64 = 7200;
pub const MAX_TICKS: u32 = 108000;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    PrismBreaker,
}
impl Kind {
    pub fn parse(s: &str) -> Result<Self, String> {
        if s == "prism-breaker" {
            Ok(Self::PrismBreaker)
        } else {
            Err("Unknown game".into())
        }
    }
    pub fn id(self) -> &'static str {
        "prism-breaker"
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Body {
    pub x: i32,
    pub y: i32,
    pub vx: i32,
    pub vy: i32,
    pub tag: i32,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    pub kind: Kind,
    pub tick: u32,
    pub score: u32,
    pub lives: i32,
    pub level: u32,
    pub over: bool,
    pub x: i32,
    pub combo: u32,
    pub cooldown: u32,
    pub wave_tick: u32,
    pub destroyed: u32,
    pub refraction: u32,
    pub refract_latch: u8,
    pub refractions: u32,
    pub refract_dir: i32,
    pub wide: u32,
    pub slow: u32,
    pub pierce: u32,
    pub shield: u32,
    pub perks: [u32; 6],
    pub offers: Vec<usize>,
    pub draft: bool,
    pub cells: Vec<i32>,
    pub types: Vec<i32>,
    pub bodies: Vec<Body>,
    pub pickups: Vec<Body>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
enum Action {
    Ticks { inputs: Vec<u8> },
    Perk { choice: usize },
}
impl Game {
    pub fn new(kind: Kind) -> Self {
        let mut g = Self {
            kind,
            tick: 0,
            score: 0,
            lives: 3,
            level: 1,
            over: false,
            x: 500,
            combo: 0,
            cooldown: 0,
            wave_tick: 0,
            destroyed: 0,
            refraction: 4,
            refract_latch: 0,
            refractions: 0,
            refract_dir: 0,
            wide: 0,
            slow: 0,
            pierce: 0,
            shield: 0,
            perks: [0; 6],
            offers: vec![],
            draft: false,
            cells: vec![],
            types: vec![],
            bodies: vec![],
            pickups: vec![],
        };
        g.load_level();
        g
    }
    fn ball(&self, vx: i32) -> Body {
        Body { x: self.x, y: 510, vx, vy: -(10 + (self.level as i32 / 4).min(6)), tag: 0 }
    }
    fn half(&self) -> i32 {
        58 + self.perks[0] as i32 * 7 + if self.wide > 0 { 30 } else { 0 }
    }
    fn point(&self, n: usize) -> (i32, i32) {
        (71 + n as i32 % 12 * 78, 115 + n as i32 / 12 * 33 + (self.wave_tick as i32 / 900 * 12).min(48))
    }
    fn load_level(&mut self) {
        let levels: Value = serde_json::from_str(include_str!("../../arcade/web/prism-levels.json")).expect("authored levels");
        let rows =
            levels[(self.level as usize - 1) % 24]["rows"].as_array().unwrap().iter().map(|r| r.as_str().unwrap()).collect::<String>();
        self.cells = rows
            .chars()
            .map(|c| match c {
                '.' => 0,
                '2' => 2,
                '3' => 3,
                _ => 1,
            })
            .collect();
        self.types = rows
            .chars()
            .map(|c| match c {
                'X' => 1,
                'C' => 2,
                _ => 0,
            })
            .collect();
        self.bodies = vec![self.ball(7)];
        self.pickups.clear();
        self.wave_tick = 0;
        self.wide = 0;
        self.slow = 0;
        self.pierce = 0;
        self.refraction = 4;
        self.refract_latch = 0;
        self.shield = self.perks[5];
        self.cooldown = 0;
        self.combo = 0;
        self.draft = false;
        self.offers.clear();
    }
    pub fn view(&self) -> Value {
        serde_json::to_value(self).expect("game")
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.tick > MAX_TICKS
            || !(1..=24).contains(&self.level)
            || self.score > 10000000
            || !(0..=3).contains(&self.lives)
            || self.cells.len() != 96
            || self.types.len() != 96
            || self.cells.iter().any(|n| !(0..=3).contains(n))
            || self.types.iter().any(|n| !(0..=2).contains(n))
            || self.perks.iter().any(|n| *n > 4)
            || self.bodies.len() > 3
            || self.pickups.len() > 24
            || self.offers.len() > 3
            || self.offers.iter().any(|n| *n >= 6)
            || self.refraction > 6
            || ![0, 4, 8, 12].contains(&self.refract_latch)
            || self.refractions > MAX_TICKS
            || !(-1..=1).contains(&self.refract_dir)
            || self.shield > 5
            || self.wide > 720
            || self.slow > 720
            || self.pierce > 720
            || self.cooldown > 360
            || self.wave_tick > self.tick
            || self.x < 15
            || self.x > 985
            || self.bodies.iter().any(|b| b.x < 0 || b.x > 1000 || b.y < 0 || b.y >= 640 || b.vx.abs() > 12 || b.vy.abs() > 16)
            || self.pickups.iter().any(|b| b.tag < 0 || b.tag > 5)
        {
            return Err("Invalid crystal campaign snapshot".into());
        }
        Ok(())
    }
    pub fn apply(&mut self, v: &Value) -> Result<(), String> {
        let a: Action = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
        if self.over {
            return Err("Finished run".into());
        }
        match a {
            Action::Ticks { inputs } => {
                if self.draft || inputs.is_empty() || inputs.len() > 60 || inputs.iter().any(|i| *i > 31) {
                    return Err("Invalid input tape or pending perk".into());
                }
                for i in inputs {
                    self.step(i);
                }
            }
            Action::Perk { choice } => {
                if !self.draft || !self.offers.contains(&choice) {
                    return Err("Choose an offered perk".into());
                }
                self.perks[choice] += 1;
                self.level += 1;
                self.load_level();
            }
        }
        self.validate()
    }
    fn damage(&mut self, n: usize, power: i32) {
        if self.cells[n] == 0 {
            return;
        }
        self.cells[n] = (self.cells[n] - power).max(0);
        if self.cells[n] > 0 {
            return;
        }
        self.combo += 1;
        self.destroyed += 1;
        self.refraction = (self.refraction + 1).min(6);
        self.score += 10 * self.combo.min(8 + self.perks[4] * 2);
        let (x, y) = self.point(n);
        if (self.destroyed.is_multiple_of(5) || self.types[n] == 2) && self.pickups.len() < 24 {
            self.pickups.push(Body { x, y, vx: 0, vy: 3, tag: ((self.destroyed + self.level) % 6) as i32 });
        }
        if self.types[n] == 1 {
            let n = n as i32;
            for j in [n - 12, n + 12, if n % 12 > 0 { n - 1 } else { -1 }, if n % 12 < 11 { n + 1 } else { -1 }] {
                if (0..96).contains(&j) {
                    self.damage(j as usize, 1);
                }
            }
        }
    }
    pub fn step(&mut self, input: u8) {
        if self.over || self.draft {
            return;
        }
        self.tick += 1;
        self.wave_tick += 1;
        self.wide = self.wide.saturating_sub(1);
        self.slow = self.slow.saturating_sub(1);
        self.pierce = self.pierce.saturating_sub(1);
        self.cooldown = self.cooldown.saturating_sub(1);
        let bend = input & 12;
        if bend != 0 && self.refract_latch == 0 && self.refraction >= 4 && !self.bodies.is_empty() {
            let direction = if bend & 4 != 0 { -1 } else { 1 };
            self.refraction -= 4;
            self.refractions += 1;
            self.refract_dir = direction;
            for b in &mut self.bodies {
                b.vx = direction * (6 + b.vx.abs().min(6));
                b.vy = -b.vy.abs().max(8);
            }
        }
        self.refract_latch = bend;
        let half = self.half();
        self.x = (self.x + if input & 1 != 0 { -19 } else { 0 } + if input & 2 != 0 { 19 } else { 0 }).clamp(half + 15, 985 - half);
        if input & 16 != 0 && self.cooldown == 0 {
            let mut targets: Vec<_> = (0..96).filter(|n| self.cells[*n] > 0 && (self.point(*n).0 - self.x).abs() < 115).collect();
            targets.sort_by_key(|n| (-self.point(*n).1, *n));
            for n in targets.into_iter().take(3) {
                self.damage(n, 2 + self.perks[1] as i32);
            }
            self.cooldown = 360;
        }
        let mut balls = std::mem::take(&mut self.bodies);
        for b in &mut balls {
            if self.slow > 0 && self.tick.is_multiple_of(2) {
                continue;
            }
            let old_x = b.x;
            let old_y = b.y;
            b.x += b.vx;
            b.y += b.vy;
            if b.x < 18 {
                b.x = 18;
                b.vx = b.vx.abs();
            }
            if b.x > 982 {
                b.x = 982;
                b.vx = -b.vx.abs();
            }
            if b.y < 82 {
                b.y = 82;
                b.vy = b.vy.abs();
            }
            if b.vy > 0 && old_y < 550 && b.y >= 550 && (b.x - self.x).abs() < half + 7 {
                b.y = 549;
                b.vy = -(10 + (self.level as i32 / 4).min(6));
                b.vx = ((b.x - self.x) / 6).clamp(-12, 12);
                if b.vx == 0 {
                    b.vx = 3;
                }
                self.combo = 0;
            }
            for n in 0..96 {
                if self.cells[n] == 0 {
                    continue;
                }
                let (x, y) = self.point(n);
                if (b.x - x).abs() < 41 && (b.y - y).abs() < 18 {
                    self.damage(n, 1 + self.perks[1] as i32);
                    if self.pierce == 0 {
                        if (old_x - x).abs() >= 41 {
                            b.vx = -b.vx;
                            b.x = old_x;
                        } else {
                            b.vy = -b.vy;
                            b.y = old_y;
                        }
                    }
                    break;
                }
            }
            if b.y > 590 && b.vy > 0 && self.shield > 0 {
                self.shield -= 1;
                b.y = 589;
                b.vy = -b.vy.abs();
            }
        }
        balls.retain(|b| b.y < 640);
        self.bodies = balls;
        let mut pickups = std::mem::take(&mut self.pickups);
        for p in &mut pickups {
            p.y += p.vy;
            if (530..=575).contains(&p.y) && (p.x - self.x).abs() < half + 18 + self.perks[2] as i32 * 35 {
                let duration = 360 + self.perks[3] * 90;
                match p.tag {
                    0 => self.wide = duration,
                    1 => self.slow = duration,
                    2 => {
                        for vx in [-9, 9] {
                            if self.bodies.len() < 3 {
                                self.bodies.push(self.ball(vx));
                            }
                        }
                    }
                    3 => self.shield = (self.shield + 1).min(5),
                    4 => self.pierce = duration,
                    5 => self.cooldown = 0,
                    _ => {}
                }
                p.tag = -1;
            }
        }
        pickups.retain(|p| p.tag >= 0 && p.y < 630);
        self.pickups = pickups;
        if self.cells.iter().all(|n| *n == 0) {
            self.score += 500 + self.level * 100;
            if self.level == 24 {
                self.over = true;
            } else {
                self.draft = true;
                self.offers.clear();
                for i in 0..6 {
                    let p = (self.level as usize + i * 5) % 6;
                    if self.perks[p] < 4 && self.offers.len() < 3 {
                        self.offers.push(p);
                    }
                }
            }
        } else if self.bodies.is_empty() {
            self.lives -= 1;
            self.combo = 0;
            self.wide = 0;
            self.slow = 0;
            self.pierce = 0;
            if self.lives == 0 {
                self.over = true;
            } else {
                self.bodies = vec![self.ball(7)];
            }
        }
        if self.tick >= MAX_TICKS {
            self.over = true;
            self.draft = false;
            self.offers.clear();
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refraction_has_direction_cost_and_release_latch() {
        let mut g = Game::new(Kind::PrismBreaker);
        g.bodies = vec![Body { x: 500, y: 450, vx: 7, vy: 12, tag: 0 }];
        g.step(4);
        assert_eq!((g.refraction, g.refractions, g.bodies[0].vx, g.bodies[0].vy), (0, 1, -12, -12));
        g.refraction = 6;
        g.step(4);
        assert_eq!(g.refractions, 1);
        g.step(0);
        g.step(8);
        assert_eq!((g.refractions, g.refract_dir, g.refraction), (2, 1, 2));
        g.validate().unwrap();
        g.step(0);
        g.step(4);
        assert_eq!(g.refractions, 2);
    }
    #[test]
    fn authored_layouts_and_perks() {
        let mut layouts = std::collections::HashSet::new();
        let mut g = Game::new(Kind::PrismBreaker);
        for level in 1..=24 {
            g.level = level;
            g.load_level();
            assert!(layouts.insert(g.cells.clone()));
            g.cells.fill(0);
            g.step(0);
            if level < 24 {
                assert!(g.draft);
                assert!(g.apply(&serde_json::json!({"type":"ticks","inputs":[0]})).is_err());
                assert!(g.apply(&serde_json::json!({"type":"perk","choice":99})).is_err());
                let choice = g.offers[0];
                g.apply(&serde_json::json!({"type":"perk","choice":choice})).unwrap();
                assert_eq!(g.level, level + 1);
            } else {
                assert!(g.over);
            }
        }
    }
    #[test]
    fn capsules_and_armour() {
        for tag in 0..6 {
            let mut g = Game::new(Kind::PrismBreaker);
            g.cooldown = 200;
            g.pickups.push(Body { x: 500, y: 530, vx: 0, vy: 3, tag });
            g.step(0);
            assert!(g.pickups.is_empty());
            match tag {
                0 => assert_eq!(g.wide, 360),
                1 => assert_eq!(g.slow, 360),
                2 => assert_eq!(g.bodies.len(), 3),
                3 => assert_eq!(g.shield, 1),
                4 => assert_eq!(g.pierce, 360),
                _ => assert_eq!(g.cooldown, 0),
            }
            g.validate().unwrap();
        }
        let mut g = Game::new(Kind::PrismBreaker);
        g.cells[0] = 3;
        g.damage(0, 1);
        assert_eq!(g.cells[0], 2);
        g.damage(0, 2);
        assert_eq!(g.cells[0], 0);
    }
    #[test]
    fn fails_closed() {
        let mut g = Game::new(Kind::PrismBreaker);
        for a in [
            serde_json::json!({"type":"perk","choice":0}),
            serde_json::json!({"type":"ticks","inputs":[32]}),
            serde_json::json!({"type":"ticks","inputs":[]}),
            serde_json::json!({"type":"ticks","inputs":[0],"score":999}),
        ] {
            assert!(g.apply(&a).is_err());
        }
        assert_eq!(g.tick, 0);
    }
}
