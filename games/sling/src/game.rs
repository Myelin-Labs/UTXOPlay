use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const ID: &str = "myelin-sling";
pub const PORT: u16 = 8782;
pub const MAX_ACTIONS: u64 = 1000;
const SCALE: i64 = 1000;
const GROUND: i64 = 480 * SCALE;
const RADIUS: i64 = 16 * SCALE;

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
}
impl Default for Game {
    fn default() -> Self {
        Self::level(1, 0)
    }
}
impl Game {
    fn level(level: u32, score: u32) -> Self {
        let offset = (level as i64 - 1) * 36;
        let mut targets = vec![];
        let mut add = |x, y, w, h, kind: &str, hp| {
            targets.push(Target {
                x: (x + offset) * SCALE,
                y: y * SCALE,
                w: w * SCALE,
                h: h * SCALE,
                kind: kind.into(),
                hp,
            })
        };
        add(670, 390, 24, 90, "wood", 1);
        add(782, 390, 24, 90, "wood", 1);
        add(657, 368, 162, 22, "wood", 1);
        add(710, 422, 42, 58, "sprite", 1);
        add(709, 311, 42, 57, "sprite", 1);
        if level >= 2 {
            add(872, 416, 40, 64, "sprite", 1);
            add(852, 388, 20, 92, "stone", 2);
        }
        if level >= 3 {
            add(690, 250, 24, 60, "wood", 1);
            add(764, 250, 24, 60, "wood", 1);
            add(688, 230, 104, 20, "wood", 1);
            add(727, 177, 42, 53, "sprite", 1);
        }
        Self {
            level,
            shots: 4,
            score,
            level_start_score: score,
            targets,
            trace: vec![],
            hits: vec![],
            world_trace: vec![],
        }
    }
    fn remaining(&self) -> usize {
        self.targets
            .iter()
            .filter(|t| t.kind == "sprite" && t.hp > 0)
            .count()
    }
    pub fn apply(&mut self, a: &Value) -> Result<(), String> {
        match a.get("type").and_then(Value::as_str) {
            Some("next") if self.remaining() == 0 && self.level < 3 => {
                *self = Self::level(self.level + 1, self.score);
                return Ok(());
            }
            Some("retry") if self.shots == 0 && self.remaining() > 0 => {
                *self = Self::level(self.level, self.level_start_score);
                return Ok(());
            }
            Some("launch") => {}
            _ => return Err("Action unavailable in the current level".into()),
        }
        if self.shots == 0 || self.remaining() == 0 {
            return Err("This level has ended".into());
        }
        let dx = a
            .get("dx")
            .and_then(Value::as_i64)
            .ok_or("dx must be an integer")?;
        let dy = a
            .get("dy")
            .and_then(Value::as_i64)
            .ok_or("dy must be an integer")?;
        if !(-120..=-8).contains(&dx) || !(-20..=100).contains(&dy) || dx * dx + dy * dy > 14400 {
            return Err("Pull must be inside the sling's 120 pixel radius".into());
        }
        self.shots -= 1;
        self.trace.clear();
        self.hits.clear();
        self.world_trace.clear();
        let (mut x, mut y) = (180 * SCALE, 360 * SCALE);
        let (mut vx, mut vy) = (-dx * 135, -dy * 135);
        let mut hit = vec![false; self.targets.len()];
        // 600 fixed microsteps, one half of a 60 Hz frame. All arithmetic is integer.
        for step in 0..600 {
            vy += 110;
            x += vx / 2;
            y += vy / 2;
            self.trace.push([x, y]);
            for (i, t) in self.targets.iter_mut().enumerate() {
                if t.hp == 0 || hit[i] {
                    continue;
                }
                let cx = x.clamp(t.x, t.x + t.w);
                let cy = y.clamp(t.y, t.y + t.h);
                if (x - cx).pow(2) + (y - cy).pow(2) <= RADIUS.pow(2) {
                    t.hp -= 1;
                    hit[i] = true;
                    self.hits.push([step, i as i64, t.hp]);
                    if t.hp == 0 {
                        self.score += if t.kind == "sprite" { 500 } else { 100 };
                    }
                    vx = vx * 3 / 4;
                    vy -= 1000;
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
        if self.remaining() == 0 {
            self.score += self.shots * 250;
        }
        Ok(())
    }
    pub fn view(&self) -> Value {
        json!({"level":self.level,"shots":self.shots,"score":self.score,"targets":self.targets,"trace":self.trace,"hits":self.hits,"world_trace":self.world_trace,"remaining":self.remaining(),"won":self.remaining()==0,"lost":self.shots==0&&self.remaining()>0,"scale":SCALE})
    }
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=3).contains(&self.level)
            || self.shots > 4
            || self.trace.len() > 600
            || self.world_trace.len() != self.trace.len()
        {
            Err("Invalid game snapshot".into())
        } else {
            Ok(())
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
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
    fn all_three_islands_are_winnable() {
        let mut game = Game::default();
        for level in 1..=3 {
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
            if level < 3 {
                game.apply(&json!({"type":"next"})).unwrap();
            }
        }
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
