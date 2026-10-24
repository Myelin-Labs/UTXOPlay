//! Integer-only arcade rules. Browser prediction is checked against this executor.
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub const ID: &str = "myelin-arcade";
pub const PORT: u16 = 8785;
pub const MAX_ACTIONS: u64 = 1800;
pub const MAX_TICKS: u32 = 18000;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    PrismBreaker,
    NeonCoil,
    Starfall,
    DriftRun,
}
impl Kind {
    pub fn parse(s: &str) -> Result<Self, String> {
        serde_json::from_value(Value::String(s.into())).map_err(|_| "Unknown arcade game".into())
    }
    pub fn id(self) -> &'static str {
        match self {
            Self::PrismBreaker => "prism-breaker",
            Self::NeonCoil => "neon-coil",
            Self::Starfall => "starfall",
            Self::DriftRun => "drift-run",
        }
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
impl Body {
    fn at(x: i32, y: i32, vx: i32, vy: i32, tag: i32) -> Self {
        Self { x, y, vx, vy, tag }
    }
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
    pub y: i32,
    pub vx: i32,
    pub vy: i32,
    pub dir: i32,
    pub next_dir: i32,
    pub cooldown: i32,
    pub combo: u32,
    pub rng: u32,
    pub energy: u32,
    pub ability_ticks: u32,
    pub ability_lock: u32,
    pub specials: u32,
    pub echo_lane: i32,
    pub echo_ticks: u32,
    pub loop_area: u32,
    pub bodies: Vec<Body>,
    pub trail: Vec<[i32; 2]>,
    pub cells: Vec<i32>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Action {
    #[serde(rename = "type")]
    kind: String,
    inputs: Vec<u8>,
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
            y: 750,
            vx: 7,
            vy: -10,
            dir: 1,
            next_dir: 1,
            cooldown: 0,
            combo: 0,
            rng: 73129,
            energy: 0,
            ability_ticks: 0,
            ability_lock: 0,
            specials: 0,
            echo_lane: 1,
            echo_ticks: 0,
            loop_area: 0,
            bodies: vec![],
            trail: vec![],
            cells: vec![],
        };
        match kind {
            Kind::PrismBreaker => {
                g.y = 700;
                g.cells = vec![1; 48];
                g.bodies.push(Body::at(500, 700, 7, -10, 0));
            }
            Kind::NeonCoil => {
                g.trail = vec![[10, 12], [9, 12], [8, 12], [7, 12], [6, 12], [5, 12]];
                g.lives = 1;
                g.food();
            }
            Kind::Starfall => g.wave(),
            Kind::DriftRun => {
                g.x = 1;
                g.lives = 1;
            }
        };
        g
    }
    fn rand(&mut self) -> u32 {
        self.rng = (u64::from(self.rng) * 16807 % 2147483647) as u32;
        self.rng
    }
    fn food(&mut self) {
        for _ in 0..500 {
            let n = self.rand() % 400;
            let p = [(n % 20) as i32, (n / 20) as i32];
            if !self.trail.contains(&p) {
                self.x = p[0];
                self.y = p[1];
                return;
            }
        }
        for y in 0..20 {
            for x in 0..20 {
                if !self.trail.contains(&[x, y]) {
                    self.x = x;
                    self.y = y;
                    return;
                }
            }
        }
        self.over = true;
    }
    fn wave(&mut self) {
        self.bodies.clear();
        for row in 0..4 {
            for col in 0..8 {
                self.bodies.push(Body::at(160 + col * 90, 110 + row * 70, 2 + (self.level as i32).min(5), 0, 1));
            }
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.tick > MAX_TICKS
            || self.level > 1000
            || self.score > 10000000
            || self.lives < 0
            || self.lives > 3
            || self.bodies.len() > 256
            || self.trail.len() > 400
            || (self.kind == Kind::NeonCoil && self.trail.is_empty())
            || self.trail.iter().any(|p| !(0..20).contains(&p[0]) || !(0..20).contains(&p[1]))
            || self.cells.len() > 48
            || self.energy > if self.kind == Kind::DriftRun { 3 } else { 6 }
            || self.ability_ticks > 45
            || self.ability_lock > 60
            || self.echo_ticks > 20
            || !(0..=2).contains(&self.echo_lane)
            || self.loop_area > 400
            || self.specials > MAX_TICKS
            || self.rng == 0
            || self.rng >= 2147483647
        {
            return Err("Invalid arcade snapshot".into());
        }
        Ok(())
    }
    pub fn view(&self) -> Value {
        serde_json::to_value(self).expect("serializable rules")
    }
    pub fn apply(&mut self, v: &Value) -> Result<(), String> {
        let a: Action = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
        if a.kind != "ticks" || a.inputs.is_empty() || a.inputs.len() > 60 || a.inputs.iter().any(|i| *i > 31) || self.over {
            return Err("Invalid input tape or finished run".into());
        }
        for input in a.inputs {
            self.step(input);
        }
        self.validate()
    }
    pub fn step(&mut self, input: u8) {
        if self.over {
            return;
        }
        self.tick += 1;
        if self.kind == Kind::NeonCoil {
            self.ability_ticks = self.ability_ticks.saturating_sub(1);
        }
        match self.kind {
            Kind::PrismBreaker => self.breaker(input),
            Kind::NeonCoil => self.snake(input),
            Kind::Starfall => self.shooter(input),
            Kind::DriftRun => self.runner(input),
        }
        if self.tick >= MAX_TICKS {
            self.over = true;
        }
    }
    fn breaker(&mut self, i: u8) {
        self.x = (self.x + if i & 1 != 0 { -24 } else { 0 } + if i & 2 != 0 { 24 } else { 0 }).clamp(90, 910);
        let mut b = self.bodies[0].clone();
        let old_y = b.y;
        b.x += b.vx;
        b.y += b.vy;
        if b.x < 20 {
            b.x = 20;
            b.vx = b.vx.abs();
        }
        if b.x > 980 {
            b.x = 980;
            b.vx = -b.vx.abs();
        }
        if b.y < 25 {
            b.y = 25;
            b.vy = b.vy.abs();
        }
        if b.vy > 0 && old_y < 865 && b.y >= 865 && (b.x - self.x).abs() < 108 {
            b.y = 864;
            b.vy = -(11 + (self.level as i32).min(8));
            b.vx = ((b.x - self.x) / 10).clamp(-10, 10);
            if b.vx == 0 {
                b.vx = 3;
            }
            self.combo = 0;
        }
        for n in 0..48 {
            if self.cells[n] == 0 {
                continue;
            }
            let x = 70 + (n as i32 % 8) * 110;
            let y = 135 + (n as i32 / 8) * 48;
            if (b.x - x).abs() < 57 && (b.y - y).abs() < 30 {
                self.cells[n] = 0;
                b.vy = -b.vy;
                self.combo += 1;
                self.score += 10 * self.combo.min(8);
                break;
            }
        }
        if b.y > 1020 {
            self.lives -= 1;
            self.combo = 0;
            if self.lives == 0 {
                self.over = true;
            }
            b = Body::at(self.x, 700, 7, -10, 0);
        }
        if self.cells.iter().all(|v| *v == 0) {
            self.level += 1;
            self.cells.fill(1);
            self.score += 500;
            b = Body::at(self.x, 700, 7, -(10 + (self.level as i32).min(8)), 0);
        }
        self.bodies[0] = b;
    }
    fn snake(&mut self, i: u8) {
        let d = if i & 4 != 0 {
            0
        } else if i & 2 != 0 {
            1
        } else if i & 8 != 0 {
            2
        } else if i & 1 != 0 {
            3
        } else {
            self.next_dir
        };
        if (d + 2) % 4 != self.dir {
            self.next_dir = d;
        }
        let interval = (6 - (self.score / 50) as i32).max(3) as u32;
        if !self.tick.is_multiple_of(interval) {
            return;
        }
        self.dir = self.next_dir;
        let mut p = self.trail[0];
        p[0] += match self.dir {
            1 => 1,
            3 => -1,
            _ => 0,
        };
        p[1] += match self.dir {
            0 => -1,
            2 => 1,
            _ => 0,
        };
        let eat = p == [self.x, self.y];
        let len = self.trail.len() - usize::from(!eat);
        let hit = self.trail[..len].iter().position(|t| *t == p);
        if let Some(j) = hit.filter(|j| *j >= 7) {
            let area = enclosed_area(&self.trail[..=j]);
            if area > 0 {
                self.loop_area = area;
                self.specials += 1;
                self.ability_ticks = 45;
                self.score += 40 + area * 10;
                self.level = 1 + self.score / 50;
                self.trail = vec![p, self.trail[0], self.trail[1]];
                self.food();
                return;
            }
        }
        if p[0] < 0 || p[0] >= 20 || p[1] < 0 || p[1] >= 20 || hit.is_some() {
            self.over = true;
            self.lives = 0;
            return;
        }
        self.trail.insert(0, p);
        if eat {
            self.score += 10;
            self.level = 1 + self.score / 50;
            self.food();
        } else {
            self.trail.pop();
        }
    }
    fn shooter(&mut self, i: u8) {
        self.x = (self.x + if i & 1 != 0 { -18 } else { 0 } + if i & 2 != 0 { 18 } else { 0 }).clamp(35, 965);
        self.ability_lock = self.ability_lock.saturating_sub(1);
        let guarding = i & 4 != 0 && self.ability_lock == 0 && self.ability_ticks < 45;
        if guarding {
            self.ability_ticks += 1;
        } else {
            if self.ability_ticks > 0 {
                if self.energy > 0 {
                    for n in 0..self.energy {
                        self.bodies.push(Body::at(self.x, 850, (2 * n as i32 - self.energy as i32 + 1) * 3, -26, 4));
                    }
                    self.specials += 1;
                    self.energy = 0;
                }
                if self.ability_ticks >= 45 {
                    self.ability_lock = 60;
                }
            }
            self.ability_ticks = 0;
        }
        if self.cooldown > 0 {
            self.cooldown -= 1;
        }
        if i & 16 != 0 && !guarding && self.cooldown == 0 {
            self.bodies.push(Body::at(self.x, 870, 0, -24, 2));
            self.cooldown = 7;
        }
        if self.vy > 0 {
            self.vy -= 1;
        }
        let bounce = self.bodies.iter().any(|b| b.tag == 1 && (b.x + b.vx < 45 || b.x + b.vx > 955));
        for b in &mut self.bodies {
            if b.tag == 1 && bounce {
                b.vx = -b.vx;
                b.y += 24;
            }
            b.x += b.vx;
            b.y += b.vy;
        }
        let period = (38 - (self.level as i32) * 3).max(13) as u32;
        if self.tick.is_multiple_of(period) {
            let enemies: Vec<_> = self.bodies.iter().filter(|b| b.tag == 1).cloned().collect();
            if !enemies.is_empty() {
                let n = self.rand() as usize % enemies.len();
                self.bodies.push(Body::at(enemies[n].x, enemies[n].y, 0, 9 + (self.level as i32).min(6), 3));
            }
        }
        for a in 0..self.bodies.len() {
            if self.bodies[a].tag != 2 && self.bodies[a].tag != 4 {
                continue;
            }
            for b in 0..self.bodies.len() {
                if self.bodies[b].tag == 1
                    && (self.bodies[a].x - self.bodies[b].x).abs() < 35
                    && (self.bodies[a].y - self.bodies[b].y).abs() < 30
                {
                    self.score += if self.bodies[a].tag == 4 { 40 } else { 20 };
                    self.bodies[a].tag = 0;
                    self.bodies[b].tag = 0;
                    break;
                }
            }
        }
        for b in &mut self.bodies {
            if b.tag == 3 && guarding && (b.x - self.x).abs() < 75 && (b.y - 880).abs() < 55 {
                b.tag = 0;
                self.energy = (self.energy + 1).min(6);
                self.score += 5;
            }
            if b.tag == 3 && self.vy == 0 && (b.x - self.x).abs() < 35 && (b.y - 900).abs() < 32 {
                b.tag = 0;
                self.lives -= 1;
                self.vy = 60;
                if self.lives == 0 {
                    self.over = true;
                }
            }
            if b.tag == 1 && b.y > 830 {
                self.over = true;
                self.lives = 0;
            }
        }
        self.bodies.retain(|b| b.tag != 0 && b.y > -40 && b.y < 1060);
        if !self.bodies.iter().any(|b| b.tag == 1) {
            self.level += 1;
            self.score += 200;
            self.wave();
        }
    }
    fn runner(&mut self, i: u8) {
        self.ability_ticks = self.ability_ticks.saturating_sub(1);
        self.echo_ticks = self.echo_ticks.saturating_sub(1);
        if i & 16 != 0 && self.ability_lock == 0 && self.energy >= 3 && self.ability_ticks == 0 {
            self.energy -= 3;
            self.ability_ticks = 45;
            self.specials += 1;
        }
        self.ability_lock = u32::from(i & 16 != 0);
        let old_lane = self.x;
        self.cooldown = (self.cooldown - 1).max(0);
        if self.cooldown == 0 {
            if i & 1 != 0 {
                self.x = (self.x - 1).max(0);
                self.cooldown = 7;
            } else if i & 2 != 0 {
                self.x = (self.x + 1).min(2);
                self.cooldown = 7;
            }
        }
        if self.x != old_lane {
            self.echo_lane = old_lane;
            self.echo_ticks = 20;
        }
        self.level = 1 + self.tick / 600;
        let speed = 9 + (self.level as i32).min(14) + if self.ability_ticks > 0 { 7 } else { 0 };
        if self.tick % 36 == 1 {
            let lane = (self.rand() % 3) as i32;
            self.bodies.push(Body::at(lane, -80, 0, speed, 1));
            let coin = (lane + 1 + (self.rand() % 2) as i32) % 3;
            self.bodies.push(Body::at(coin, -240, 0, speed, 2));
        }
        for b in &mut self.bodies {
            let old_y = b.y;
            b.y += speed;
            if b.tag == 1 && old_y < 830 && b.y >= 830 && (b.x - self.x).abs() == 1 {
                self.energy = (self.energy + 1).min(3);
                self.score += 15;
                self.combo += 1;
            }
            if (b.y - 830).abs() < 48 {
                if b.x == self.x && b.tag == 1 {
                    if self.ability_ticks > 0 {
                        self.score += 50;
                        b.tag = 0;
                    } else {
                        self.over = true;
                        self.lives = 0;
                    }
                } else if b.tag == 2 && (b.x == self.x || (self.echo_ticks > 0 && b.x == self.echo_lane)) {
                    self.score += if b.x == self.x { 25 } else { 40 };
                    if b.x != self.x {
                        self.energy = (self.energy + 1).min(3);
                    }
                    b.tag = 0;
                }
            }
        }
        self.bodies.retain(|b| b.y < 1100 && b.tag != 0);
        if self.tick.is_multiple_of(15) {
            self.score += 1;
        }
    }
}
fn enclosed_area(boundary: &[[i32; 2]]) -> u32 {
    let mut wall = [false; 400];
    for [x, y] in boundary {
        wall[(y * 20 + x) as usize] = true;
    }
    let mut seen = [false; 400];
    let mut queue = std::collections::VecDeque::new();
    for y in 0..20 {
        for x in 0..20 {
            if x == 0 || x == 19 || y == 0 || y == 19 {
                queue.push_back((x, y));
            }
        }
    }
    while let Some((x, y)) = queue.pop_front() {
        if !(0..20).contains(&x) || !(0..20).contains(&y) {
            continue;
        }
        let n = (y * 20 + x) as usize;
        if wall[n] || seen[n] {
            continue;
        }
        seen[n] = true;
        queue.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]);
    }
    (0..400).filter(|n| !wall[*n] && !seen[*n]).count() as u32
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closed_circuit_burns_loop_but_short_knots_kill() {
        let mut g = Game::new(Kind::NeonCoil);
        g.trail = vec![[3, 2], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3]];
        g.tick = 5;
        g.dir = 2;
        g.next_dir = 2;
        g.x = 10;
        g.y = 10;
        g.step(8);
        assert!(!g.over);
        assert_eq!((g.specials, g.loop_area, g.score), (1, 1, 50));
        assert_eq!(g.trail.len(), 3);
        g.validate().unwrap();
        assert_eq!(enclosed_area(&[[1, 1], [2, 1], [3, 1]]), 0);
        let mut k = Game::new(Kind::NeonCoil);
        k.trail = vec![[2, 2], [2, 1], [1, 1], [1, 2], [1, 3]];
        k.tick = 5;
        k.dir = 3;
        k.next_dir = 3;
        k.step(1);
        assert!(k.over);
    }
    #[test]
    fn capture_release_and_overheat_are_authoritative() {
        let mut g = Game::new(Kind::Starfall);
        g.vy = 0;
        g.bodies = vec![Body::at(100, 100, 0, 0, 1), Body::at(500, 820, 0, 10, 3)];
        g.step(20);
        assert_eq!(g.energy, 1);
        assert_eq!(g.lives, 3);
        assert!(!g.bodies.iter().any(|b| b.tag == 2 || b.tag == 3));
        g.step(0);
        assert_eq!(g.energy, 0);
        assert_eq!(g.specials, 1);
        assert_eq!(g.bodies.iter().filter(|b| b.tag == 4).count(), 1);
        g.validate().unwrap();
        let mut hot = Game::new(Kind::Starfall);
        for _ in 0..46 {
            hot.step(4);
        }
        assert_eq!((hot.ability_ticks, hot.ability_lock), (0, 60));
    }
    #[test]
    fn echo_pickups_close_passes_and_burst_do_not_double_count() {
        let mut e = Game::new(Kind::DriftRun);
        e.bodies = vec![Body::at(1, 810, 0, 0, 2)];
        e.step(2);
        assert_eq!((e.x, e.echo_lane, e.score, e.energy), (2, 1, 40, 1));
        let mut g = Game::new(Kind::DriftRun);
        g.bodies = vec![Body::at(0, 825, 0, 0, 1)];
        g.step(0);
        g.step(0);
        assert_eq!((g.energy, g.combo), (1, 1));
        g.energy = 3;
        g.bodies = vec![Body::at(g.x, 800, 0, 0, 1)];
        g.step(16);
        assert!(!g.over);
        assert_eq!((g.energy, g.specials, g.ability_ticks), (0, 1, 45));
        g.validate().unwrap();
        g.energy = 3;
        for _ in 0..46 {
            g.bodies.clear();
            g.step(16);
        }
        assert_eq!(g.specials, 1);
    }
    #[test]
    fn tapes_fail_closed_and_replay() {
        for kind in [Kind::PrismBreaker, Kind::NeonCoil, Kind::Starfall, Kind::DriftRun] {
            let mut a = Game::new(kind);
            assert!(a.apply(&serde_json::json!({"type":"ticks","inputs":[32]})).is_err());
            assert!(a.apply(&serde_json::json!({"type":"ticks","inputs":[1],"score":999})).is_err());
            assert!(a.apply(&serde_json::json!({"type":"ticks","inputs":[]})).is_err());
            let mut b = a.clone();
            for i in 0..600 {
                a.step((i % 32) as u8);
                b.step((i % 32) as u8);
            }
            assert_eq!(a, b);
            a.validate().unwrap();
        }
    }
    #[test]
    fn snake_cannot_reverse_and_walls_end_run() {
        let mut g = Game::new(Kind::NeonCoil);
        g.step(1);
        assert_eq!(g.next_dir, 1);
        for _ in 0..80 {
            g.step(0);
        }
        assert!(g.over);
        assert_eq!(g.lives, 0);
    }
    #[test]
    fn breaker_collision_and_life_loss() {
        let mut g = Game::new(Kind::PrismBreaker);
        g.bodies[0] = Body::at(70, 150, 0, -10, 0);
        g.step(0);
        assert_eq!(g.score, 10);
        assert_eq!(g.cells[0], 0);
        g.bodies[0] = Body::at(30, 1018, 0, 10, 0);
        g.step(0);
        assert_eq!(g.lives, 2);
    }
    #[test]
    fn runner_collision_is_authoritative() {
        let mut g = Game::new(Kind::DriftRun);
        g.bodies.push(Body::at(1, 820, 0, 10, 1));
        g.step(0);
        assert!(g.over);
    }
}
