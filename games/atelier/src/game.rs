//! Four integer-only games. Native execution is authoritative; browser state is predictive.
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub const ID: &str = "myelin-atelier";
pub const PORT: u16 = 8788;
pub const MAX_ACTIONS: u64 = 3600;
pub const MAX_TICKS: i32 = 54000;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    RuneFoundry,
    LumenWeave,
    OrbitCourier,
    Mosslight,
}
impl Kind {
    pub fn parse(s: &str) -> Result<Self, String> {
        serde_json::from_value(Value::String(s.into())).map_err(|_| "Unknown atelier game".into())
    }
    pub fn id(self) -> &'static str {
        match self {
            Self::RuneFoundry => "rune-foundry",
            Self::LumenWeave => "lumen-weave",
            Self::OrbitCourier => "orbit-courier",
            Self::Mosslight => "mosslight",
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entity {
    pub x: i32,
    pub y: i32,
    pub kind: i32,
    pub age: i32,
}
impl Entity {
    fn new(x: i32, y: i32, kind: i32, age: i32) -> Self {
        Self { x, y, kind, age }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    pub kind: Kind,
    pub tick: i32,
    pub score: i32,
    pub lives: i32,
    pub level: i32,
    pub over: bool,
    pub won: bool,
    pub rng: u32,
    pub x: i32,
    pub y: i32,
    pub dir: i32,
    pub cooldown: i32,
    pub energy: i32,
    pub combo: i32,
    pub progress: i32,
    pub goal: i32,
    pub phase: i32,
    pub age: i32,
    pub held: u8,
    pub turn: i32,
    pub invulnerable: i32,
    pub cargo: i32,
    pub board: Vec<i32>,
    pub aux: Vec<i32>,
    pub marks: Vec<i32>,
    pub bag: Vec<i32>,
    pub pair: [i32; 2],
    pub entities: Vec<Entity>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Action {
    #[serde(rename = "type")]
    kind: String,
    inputs: Vec<u8>,
}
const DIRS: [(i32, i32); 4] = [(0, -1), (1, 0), (0, 1), (-1, 0)];
fn rotate(m: i32) -> i32 {
    ((m << 1) & 15) | (m >> 3)
}
fn distance(a: i32) -> i32 {
    let n = a.rem_euclid(3600);
    n.min(3600 - n)
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
            won: false,
            rng: 73129,
            x: 0,
            y: 0,
            dir: 0,
            cooldown: 0,
            energy: 2,
            combo: 0,
            progress: 0,
            goal: 0,
            phase: 0,
            age: 0,
            held: 0,
            turn: 0,
            invulnerable: 0,
            cargo: 0,
            board: vec![],
            aux: vec![],
            marks: vec![],
            bag: vec![],
            pair: [0, 0],
            entities: vec![],
        };
        g.setup();
        g
    }
    fn rand(&mut self) -> i32 {
        self.rng = (u64::from(self.rng) * 16807 % 2147483647) as u32;
        self.rng as i32
    }
    fn setup(&mut self) {
        self.phase = 0;
        self.age = 0;
        self.cooldown = 0;
        self.held = 0;
        self.progress = 0;
        self.entities.clear();
        match self.kind {
            Kind::RuneFoundry => {
                self.board = vec![0; 72];
                self.bag = vec![1 + self.rand() % 4, 1 + self.rand() % 4];
                self.goal = 288;
                self.lives = 1;
                self.spawn();
            }
            Kind::LumenWeave => self.weave_level(),
            Kind::OrbitCourier => {
                self.x = 0;
                self.y = 1;
                self.dir = 1;
                self.cargo = 0;
                self.goal = 3 + self.level / 3;
                self.invulnerable = 60;
                for n in 0..3 + self.level / 2 {
                    self.entities.push(Entity::new(
                        (1800 + n * 417) % 3600,
                        n % 3,
                        1,
                        if n % 2 == 1 { 5 + self.level } else { -(5 + self.level) },
                    ));
                }
                self.packets();
            }
            Kind::Mosslight => self.garden_level(),
        }
    }
    fn advance(&mut self, max: i32) {
        self.score += 200 * self.level;
        if self.level >= max {
            self.won = true;
            self.over = true;
        } else {
            self.phase = 45;
        }
    }
    pub fn step(&mut self, input: u8) {
        if self.over {
            return;
        }
        self.tick += 1;
        if self.tick >= MAX_TICKS {
            self.over = true;
            return;
        }
        if self.phase > 0 {
            self.phase -= 1;
            if self.phase == 0 {
                self.level += 1;
                self.setup();
            }
            self.held = 0;
            return;
        }
        if self.kind == Kind::LumenWeave && (64..=99).contains(&input) {
            self.x = i32::from(input - 64) % 6;
            self.y = i32::from(input - 64) / 6;
            self.twist(usize::from(input - 64));
            self.turn += 1;
            self.power();
            if self.progress == 36 {
                self.advance(24);
            }
            self.held = 0;
            return;
        }
        let edge = input & !self.held;
        self.held = input;
        if self.cooldown > 0 {
            self.cooldown -= 1;
        }
        match self.kind {
            Kind::RuneFoundry => self.foundry(input, edge),
            Kind::LumenWeave => self.weave(input, edge),
            Kind::OrbitCourier => self.orbit(input, edge),
            Kind::Mosslight => self.garden(input, edge),
        }
    }
    fn pair_cells(x: i32, y: i32, dir: i32) -> [(i32, i32); 2] {
        let (dx, dy) = DIRS[dir as usize];
        [(x, y), (x + dx, y + dy)]
    }
    fn fits(&self, x: i32, y: i32, dir: i32) -> bool {
        Self::pair_cells(x, y, dir)
            .iter()
            .all(|&(a, b)| (0..6).contains(&a) && (-1..12).contains(&b) && (b < 0 || self.board[(b * 6 + a) as usize] == 0))
    }
    fn spawn(&mut self) {
        self.x = 2;
        self.y = 0;
        self.dir = 0;
        self.pair = [self.bag[0], self.bag[1]];
        let colors = 4 + i32::from(self.level >= 5) + i32::from(self.level >= 9);
        self.bag = vec![1 + self.rand() % colors, 1 + self.rand() % colors];
        if !self.fits(self.x, self.y, self.dir) {
            self.over = true;
            self.lives = 0;
        }
    }
    fn gravity(&mut self) {
        for x in 0..6 {
            let mut dest = 11;
            for y in (0..12).rev() {
                if self.board[y * 6 + x] > 0 {
                    let value = self.board[y * 6 + x];
                    self.board[y * 6 + x] = 0;
                    self.board[dest * 6 + x] = value;
                    dest = dest.saturating_sub(1);
                }
            }
        }
    }
    fn resolve_foundry(&mut self) {
        let mut chain = 0;
        for _ in 0..18 {
            let mut seen = [false; 72];
            let mut remove = vec![];
            let mut groups = 0;
            for n in 0..72 {
                if self.board[n] == 0 || seen[n] {
                    continue;
                }
                let mut queue = vec![n];
                seen[n] = true;
                let mut at = 0;
                while at < queue.len() {
                    let q = queue[at];
                    at += 1;
                    let (x, y) = ((q % 6) as i32, (q / 6) as i32);
                    for (dx, dy) in DIRS {
                        let (xx, yy) = (x + dx, y + dy);
                        if (0..6).contains(&xx) && (0..12).contains(&yy) {
                            let j = (yy * 6 + xx) as usize;
                            if !seen[j] && self.board[j] == self.board[n] {
                                seen[j] = true;
                                queue.push(j);
                            }
                        }
                    }
                }
                if queue.len() >= 4 {
                    remove.extend(queue);
                    groups += 1;
                }
            }
            if remove.is_empty() {
                break;
            }
            chain += 1;
            for &n in &remove {
                self.board[n] = 0;
            }
            self.score += remove.len() as i32 * 10 * chain;
            self.progress += remove.len() as i32;
            self.energy = 6.min(self.energy + groups);
            self.gravity();
        }
        self.combo = chain;
        self.level = 12.min(1 + self.progress / 24);
        if self.progress >= self.goal {
            self.won = true;
            self.over = true;
        }
    }
    fn lock(&mut self) {
        let cells = Self::pair_cells(self.x, self.y, self.dir);
        if cells.iter().any(|p| p.1 < 0) {
            self.over = true;
            self.lives = 0;
            return;
        }
        for (i, (x, y)) in cells.into_iter().enumerate() {
            self.board[(y * 6 + x) as usize] = self.pair[i];
        }
        self.resolve_foundry();
        self.age = 0;
        if !self.over {
            self.spawn();
        }
    }
    fn foundry(&mut self, input: u8, edge: u8) {
        if self.cooldown == 0 && input & 3 != 0 {
            let dx = if input & 1 != 0 { -1 } else { 1 };
            if self.fits(self.x + dx, self.y, self.dir) {
                self.x += dx;
            }
            self.cooldown = 5;
        }
        if edge & 4 != 0 {
            let dir = (self.dir + 1) % 4;
            for dx in [0, -1, 1] {
                if self.fits(self.x + dx, self.y, dir) {
                    self.x += dx;
                    self.dir = dir;
                    break;
                }
            }
        }
        if edge & 16 != 0 && self.energy >= 3 && self.board[66..].iter().any(|v| *v > 0) {
            self.energy -= 3;
            for n in 66..72 {
                if self.board[n] > 0 {
                    self.score += 5;
                }
                self.board[n] = 0;
            }
            self.gravity();
            self.resolve_foundry();
        }
        if edge & 8 != 0 {
            while self.fits(self.x, self.y + 1, self.dir) {
                self.y += 1;
            }
            self.lock();
            return;
        }
        self.age += 1;
        if self.age >= 7.max(25 - self.level) {
            self.age = 0;
            if self.fits(self.x, self.y + 1, self.dir) {
                self.y += 1;
            } else {
                self.lock();
            }
        }
    }
    fn weave_level(&mut self) {
        self.x = 0;
        self.y = 0;
        self.goal = 36;
        self.board = vec![0; 36];
        self.aux = vec![0; 36];
        let mut seen = [false; 36];
        seen[0] = true;
        let mut stack = vec![0usize];
        while let Some(&n) = stack.last() {
            let (x, y) = ((n % 6) as i32, (n / 6) as i32);
            let mut options = vec![];
            for (d, (dx, dy)) in DIRS.into_iter().enumerate() {
                let (xx, yy) = (x + dx, y + dy);
                if (0..6).contains(&xx) && (0..6).contains(&yy) {
                    let j = (yy * 6 + xx) as usize;
                    if !seen[j] {
                        options.push((d, j));
                    }
                }
            }
            if options.is_empty() {
                stack.pop();
                continue;
            }
            let (d, j) = options[self.rand() as usize % options.len()];
            self.board[n] |= 1 << d;
            self.board[j] |= 1 << ((d + 2) % 4);
            seen[j] = true;
            stack.push(j);
        }
        for n in 0..18 {
            let turns = 1 + self.rand() % 3;
            for _ in 0..turns {
                self.twist(n);
            }
        }
        self.power();
        if self.progress == 36 {
            self.twist(0);
            self.power();
        }
    }
    fn twist(&mut self, n: usize) {
        let twin = 35 - n;
        self.board[n] = rotate(self.board[n]);
        self.board[twin] = rotate(rotate(rotate(self.board[twin])));
        self.aux[n] = (self.aux[n] + 1) % 4;
        self.aux[twin] = (self.aux[twin] + 3) % 4;
    }
    fn power(&mut self) {
        self.marks = vec![0; 36];
        self.marks[0] = 1;
        let mut queue = vec![0usize];
        let mut at = 0;
        while at < queue.len() {
            let n = queue[at];
            at += 1;
            let (x, y) = ((n % 6) as i32, (n / 6) as i32);
            for (d, (dx, dy)) in DIRS.into_iter().enumerate() {
                let (xx, yy) = (x + dx, y + dy);
                if (0..6).contains(&xx) && (0..6).contains(&yy) {
                    let j = (yy * 6 + xx) as usize;
                    if self.marks[j] == 0 && self.board[n] & (1 << d) != 0 && self.board[j] & (1 << ((d + 2) % 4)) != 0 {
                        self.marks[j] = 1;
                        queue.push(j);
                    }
                }
            }
        }
        self.progress = queue.len() as i32;
    }
    fn weave(&mut self, input: u8, edge: u8) {
        if self.cooldown == 0 && input & 15 != 0 {
            self.x = (self.x
                + if input & 1 != 0 {
                    -1
                } else if input & 2 != 0 {
                    1
                } else {
                    0
                })
            .clamp(0, 5);
            self.y = (self.y
                + if input & 4 != 0 {
                    -1
                } else if input & 8 != 0 {
                    1
                } else {
                    0
                })
            .clamp(0, 5);
            self.cooldown = 6;
        }
        if edge & 16 != 0 {
            self.twist((self.y * 6 + self.x) as usize);
            self.turn += 1;
            self.power();
            if self.progress == 36 {
                self.advance(24);
            }
        }
    }
    fn packets(&mut self) {
        while self.entities.iter().filter(|e| e.kind == 2).count() < 3 {
            let x = (self.x + 600 + self.rand() % 2400) % 3600;
            let y = 1 + self.rand() % 2;
            self.entities.push(Entity::new(x, y, 2, 0));
        }
    }
    fn orbit(&mut self, input: u8, edge: u8) {
        if self.invulnerable > 0 {
            self.invulnerable -= 1;
        }
        if self.cooldown == 0 && edge & 3 != 0 {
            self.y = (self.y + if edge & 1 != 0 { -1 } else { 1 }).clamp(0, 2);
            self.cooldown = 8;
        }
        if edge & 16 != 0 && self.energy >= 2 {
            self.energy -= 2;
            self.x = (self.x + 1800) % 3600;
            self.invulnerable = 20;
            self.combo += 1;
        }
        let speed = 10 + self.level * 2 + if input & 8 != 0 { 6 } else { 0 } - if input & 4 != 0 { 6 } else { 0 };
        self.x = (self.x + speed) % 3600;
        for e in &mut self.entities {
            if e.kind == 1 {
                e.x = (e.x + e.age + 3600) % 3600;
            }
            if e.y != self.y || distance(e.x - self.x) > 85 {
                continue;
            }
            if e.kind == 1 && self.invulnerable == 0 {
                self.lives -= 1;
                self.cargo = 0.max(self.cargo - 1);
                self.invulnerable = 60;
                if self.lives == 0 {
                    self.over = true;
                }
            }
            if e.kind == 2 && self.cargo < 3 {
                self.cargo += 1;
                self.energy = 6.min(self.energy + 1);
                self.score += 20;
                e.kind = 0;
            }
        }
        self.entities.retain(|e| e.kind != 0);
        self.packets();
        if !self.over && self.y == 0 && distance(self.x) < 95 && self.cargo > 0 {
            self.progress += self.cargo;
            self.score += self.cargo * 100;
            self.cargo = 0;
            if self.progress >= self.goal {
                self.advance(12);
            }
        }
    }
    fn empty_garden(&mut self) -> (i32, i32) {
        for _ in 0..300 {
            let n = self.rand() % 121;
            let (x, y) = (n % 11, n / 11);
            if self.board[n as usize] == 0
                && (x - self.x).abs() + (y - self.y).abs() > 3
                && !self.entities.iter().any(|e| e.x == x && e.y == y)
            {
                return (x, y);
            }
        }
        for n in 0..121 {
            let (x, y) = (n % 11, n / 11);
            if self.board[n as usize] == 0 && !self.entities.iter().any(|e| e.x == x && e.y == y) && (x != self.x || y != self.y) {
                return (x, y);
            }
        }
        (0, 0)
    }
    fn garden_level(&mut self) {
        self.x = 5;
        self.y = 5;
        self.board = vec![0; 121];
        self.aux = vec![0; 121];
        self.goal = 5 + self.level / 4;
        self.energy = 6.min(self.energy + 2);
        self.invulnerable = 0;
        if self.level % 3 == 1 {
            self.lives = 3.min(self.lives + 1);
        }
        for y in 1..10 {
            for x in 1..10 {
                if x % 2 == 0 && y % 2 == 0 && self.rand() % 4 != 0 {
                    self.board[y * 11 + x] = 1;
                }
            }
        }
        for _ in 0..self.goal {
            let (x, y) = self.empty_garden();
            self.entities.push(Entity::new(x, y, 2, 0));
        }
        for _ in 0..2 + self.level / 3 {
            let (x, y) = self.empty_garden();
            self.entities.push(Entity::new(x, y, 1, 0));
        }
    }
    fn illuminated(&self, x: i32, y: i32) -> bool {
        for n in 0..121 {
            if self.aux[n] == 0 {
                continue;
            }
            let (lx, ly) = ((n % 11) as i32, (n / 11) as i32);
            if (x != lx && y != ly) || (x - lx).abs() + (y - ly).abs() > 3 {
                continue;
            }
            let (mut xx, mut yy, mut clear) = (lx, ly, true);
            while xx != x || yy != y {
                xx += (x - xx).signum();
                yy += (y - yy).signum();
                if self.board[(yy * 11 + xx) as usize] != 0 {
                    clear = false;
                    break;
                }
            }
            if clear {
                return true;
            }
        }
        false
    }
    fn garden(&mut self, input: u8, edge: u8) {
        if self.cooldown > 0 {
            return;
        }
        let mut acted = false;
        if edge & 16 != 0 && self.energy >= 2 {
            self.energy -= 2;
            self.aux[(self.y * 11 + self.x) as usize] = 4;
            acted = true;
        } else if input & 15 != 0 {
            let x = self.x
                + if input & 1 != 0 {
                    -1
                } else if input & 2 != 0 {
                    1
                } else {
                    0
                };
            let y = self.y
                + if input & 3 != 0 {
                    0
                } else if input & 4 != 0 {
                    -1
                } else if input & 8 != 0 {
                    1
                } else {
                    0
                };
            if (0..11).contains(&x) && (0..11).contains(&y) && self.board[(y * 11 + x) as usize] == 0 {
                self.x = x;
                self.y = y;
                acted = true;
            }
        }
        if !acted {
            return;
        }
        self.cooldown = 6;
        self.turn += 1;
        if self.invulnerable > 0 {
            self.invulnerable -= 1;
        }
        for e in &mut self.entities {
            if e.kind == 2 && e.x == self.x && e.y == self.y {
                e.kind = 0;
                self.score += 100;
                self.energy = 6.min(self.energy + 1);
                self.progress += 1;
            }
        }
        if self.progress >= self.goal {
            self.advance(12);
            return;
        }
        for i in 0..self.entities.len() {
            if self.entities[i].kind != 1 {
                continue;
            }
            let (x, y) = (self.entities[i].x, self.entities[i].y);
            if self.illuminated(x, y) {
                self.entities[i].kind = 0;
                self.score += 75;
                continue;
            }
            let (mut tx, mut ty, mut best) = (self.x, self.y, 100);
            for n in 0..121 {
                if self.aux[n] > 0 {
                    let d = ((n % 11) as i32 - x).abs() + ((n / 11) as i32 - y).abs();
                    if d < best {
                        best = d;
                        tx = (n % 11) as i32;
                        ty = (n / 11) as i32;
                    }
                }
            }
            let (dx, dy) = ((tx - x).signum(), (ty - y).signum());
            let moves = if self.turn % 2 == 1 { [(dx, 0), (0, dy)] } else { [(0, dy), (dx, 0)] };
            for (xx, yy) in moves {
                if xx == 0 && yy == 0 {
                    continue;
                }
                let (nx, ny) = (x + xx, y + yy);
                if (0..11).contains(&nx)
                    && (0..11).contains(&ny)
                    && self.board[(ny * 11 + nx) as usize] == 0
                    && !self.entities.iter().enumerate().any(|(j, e)| j != i && e.kind == 1 && e.x == nx && e.y == ny)
                {
                    self.entities[i].x = nx;
                    self.entities[i].y = ny;
                    break;
                }
            }
            let (x, y) = (self.entities[i].x, self.entities[i].y);
            if self.illuminated(x, y) {
                self.entities[i].kind = 0;
                self.score += 75;
                continue;
            }
            if x == self.x && y == self.y && self.invulnerable == 0 {
                self.lives -= 1;
                self.invulnerable = 3;
                self.entities[i].kind = 0;
                if self.lives == 0 {
                    self.over = true;
                }
            }
        }
        self.entities.retain(|e| e.kind != 0);
        for v in &mut self.aux {
            if *v > 0 {
                *v -= 1;
            }
        }
    }
    pub fn valid_input(kind: Kind, input: u8) -> bool {
        input <= 31 || (kind == Kind::LumenWeave && (64..=99).contains(&input))
    }
    pub fn view(&self) -> Value {
        serde_json::to_value(self).expect("serializable rules")
    }
    pub fn apply(&mut self, v: &Value) -> Result<(), String> {
        let a: Action = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
        if a.kind != "ticks"
            || a.inputs.is_empty()
            || a.inputs.len() > 60
            || a.inputs.iter().any(|i| !Self::valid_input(self.kind, *i))
            || self.over
        {
            return Err("Invalid input tape or finished run".into());
        }
        let mut next = self.clone();
        for input in a.inputs {
            next.step(input);
        }
        next.validate()?;
        *self = next;
        Ok(())
    }
    pub fn validate(&self) -> Result<(), String> {
        let fail = || Err("Invalid atelier snapshot".into());
        if !(0..=MAX_TICKS).contains(&self.tick)
            || !(0..=10000000).contains(&self.score)
            || !(0..=3).contains(&self.lives)
            || !(1..=24).contains(&self.level)
            || !(0..=6).contains(&self.energy)
            || !(0..=45).contains(&self.phase)
            || !(0..=8).contains(&self.cooldown)
            || !(0..=60).contains(&self.invulnerable)
            || !(0..=3).contains(&self.cargo)
            || self.held > 31
            || self.rng == 0
            || self.rng >= 2147483647
            || self.entities.len() > 20
            || self.won && !self.over
            || self.turn < 0
            || self.turn > MAX_TICKS
            || self.age < 0
            || self.age > 25
            || self.progress < 0
            || self.progress > 1000
            || self.combo < 0
            || self.combo > MAX_TICKS
        {
            return fail();
        }
        match self.kind {
            Kind::RuneFoundry => {
                if self.board.len() != 72
                    || self.board.iter().any(|v| !(0..=6).contains(v))
                    || self.bag.len() != 2
                    || self.bag.iter().chain(self.pair.iter()).any(|v| !(1..=6).contains(v))
                    || !(0..6).contains(&self.x)
                    || !(-1..12).contains(&self.y)
                    || !(0..4).contains(&self.dir)
                    || self.goal != 288
                    || !self.aux.is_empty()
                    || !self.marks.is_empty()
                    || !self.entities.is_empty()
                {
                    return fail();
                }
            }
            Kind::LumenWeave => {
                if self.board.len() != 36
                    || self.board.iter().any(|v| !(1..=15).contains(v))
                    || self.aux.len() != 36
                    || self.aux.iter().any(|v| !(0..4).contains(v))
                    || self.marks.len() != 36
                    || self.marks.iter().any(|v| !(0..=1).contains(v))
                    || !(0..6).contains(&self.x)
                    || !(0..6).contains(&self.y)
                    || self.goal != 36
                    || !self.entities.is_empty()
                {
                    return fail();
                }
            }
            Kind::OrbitCourier => {
                if !(0..3600).contains(&self.x)
                    || !(0..3).contains(&self.y)
                    || self
                        .entities
                        .iter()
                        .any(|e| !(0..3600).contains(&e.x) || !(0..3).contains(&e.y) || !(1..=2).contains(&e.kind) || e.age.abs() > 17)
                    || !self.board.is_empty()
                    || !self.aux.is_empty()
                    || !self.marks.is_empty()
                {
                    return fail();
                }
            }
            Kind::Mosslight => {
                if !(0..11).contains(&self.x)
                    || !(0..11).contains(&self.y)
                    || self.board.len() != 121
                    || self.board.iter().any(|v| !(0..=1).contains(v))
                    || self.aux.len() != 121
                    || self.aux.iter().any(|v| !(0..=4).contains(v))
                    || self
                        .entities
                        .iter()
                        .any(|e| !(0..11).contains(&e.x) || !(0..11).contains(&e.y) || !(1..=2).contains(&e.kind) || e.age != 0)
                    || !self.marks.is_empty()
                {
                    return fail();
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn input_validation_is_atomic_and_kind_bound() {
        for kind in [Kind::RuneFoundry, Kind::LumenWeave, Kind::OrbitCourier, Kind::Mosslight] {
            let mut g = Game::new(kind);
            let before = g.view();
            for action in [
                json!({"type":"ticks","inputs":[]}),
                json!({"type":"ticks","inputs":vec![0;61]}),
                json!({"type":"ticks","inputs":[0,255]}),
                json!({"type":"ticks","inputs":[0],"score":999}),
            ] {
                assert!(g.apply(&action).is_err());
                assert_eq!(before, g.view());
            }
            if kind != Kind::LumenWeave {
                assert!(g.apply(&json!({"type":"ticks","inputs":[64]})).is_err());
                assert_eq!(before, g.view());
            }
        }
    }
    #[test]
    fn all_twenty_four_circuits_solve_with_real_pointer_inputs() {
        let mut g = Game::new(Kind::LumenWeave);
        for level in 1..=24 {
            assert_eq!(g.level, level);
            for n in 0..18 {
                let turns = (4 - g.aux[n]) % 4;
                for _ in 0..turns {
                    if g.phase > 0 || g.over {
                        break;
                    }
                    g.apply(&json!({"type":"ticks","inputs":[64+n]})).unwrap();
                }
            }
            assert_eq!(g.progress, 36);
            while g.phase > 0 {
                g.apply(&json!({"type":"ticks","inputs":[99]})).unwrap();
            }
        }
        assert!(g.won && g.over);
    }
    #[test]
    fn garden_light_is_occluded_and_diagonal_inputs_take_one_step() {
        let mut g = Game::new(Kind::Mosslight);
        g.board.fill(0);
        g.aux[60] = 3;
        assert!(g.illuminated(8, 5));
        g.board[61] = 1;
        assert!(!g.illuminated(8, 5));
        assert!(!g.illuminated(8, 8));
        let p = (g.x, g.y);
        g.step(5);
        assert_eq!((g.x - p.0).abs() + (g.y - p.1).abs(), 1);
    }
}
