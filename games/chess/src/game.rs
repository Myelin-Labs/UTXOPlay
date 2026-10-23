use chess::{ChessMove, Color, Game as ChessGame, MoveGen};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::str::FromStr;

pub const ID: &str = "myelin-chess";
pub const PORT: u16 = 8781;
pub const MAX_ACTIONS: u64 = 1000;

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    moves: Vec<String>,
    resigned: bool,
    drawn: bool,
}

impl Game {
    fn position(&self) -> Result<ChessGame, String> {
        let mut game = ChessGame::new();
        for text in &self.moves {
            let mv = ChessMove::from_str(text).map_err(|e| e.to_string())?;
            if !game.make_move(mv) {
                return Err("Corrupt move history".into());
            }
        }
        Ok(game)
    }
    pub fn apply(&mut self, action: &Value) -> Result<(), String> {
        let mut game = self.position()?;
        if self.resigned || self.drawn || game.result().is_some() {
            return Err("This match has ended. Start a new session.".into());
        }
        match action.get("type").and_then(Value::as_str) {
            Some("move") => {
                let text = action
                    .get("uci")
                    .and_then(Value::as_str)
                    .ok_or("Missing UCI move")?;
                if text.len() < 4 || text.len() > 5 || !text.is_ascii() {
                    return Err("Invalid UCI move".into());
                }
                let mv = ChessMove::from_str(text).map_err(|_| "Invalid UCI move")?;
                if !MoveGen::new_legal(&game.current_position()).any(|m| m == mv) {
                    return Err("That move is not legal".into());
                }
                if !game.make_move(mv) {
                    return Err("Move rejected".into());
                }
                self.moves.push(mv.to_string());
            }
            Some("resign") => self.resigned = true,
            Some("claim_draw") if game.can_declare_draw() => self.drawn = true,
            Some("claim_draw") => {
                return Err("A repetition or fifty-move draw is not yet claimable".into())
            }
            _ => return Err("Unknown action".into()),
        }
        Ok(())
    }
    pub fn view(&self) -> Value {
        let game = self.position().expect("validated snapshot");
        let board = game.current_position();
        let turn = if board.side_to_move() == Color::White {
            "white"
        } else {
            "black"
        };
        let result = if self.resigned {
            Some(format!(
                "{} wins by resignation",
                if turn == "white" { "Black" } else { "White" }
            ))
        } else if self.drawn {
            Some("Draw claimed".to_owned())
        } else {
            game.result().map(|r| format!("{r:?}"))
        };
        json!({"fen":board.to_string(), "turn":turn, "in_check":board.checkers().popcnt()>0,
            "moves": self.moves, "legal_moves": if result.is_none() { MoveGen::new_legal(&board).map(|m|m.to_string()).collect::<Vec<_>>() } else {vec![]},
            "can_claim_draw":game.can_declare_draw(), "result":result})
    }
    pub fn validate(&self) -> Result<(), String> {
        self.position().map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fools_mate_and_illegal_moves() {
        let mut g = Game::default();
        assert_eq!(g.view()["legal_moves"].as_array().unwrap().len(), 20);
        assert!(g.apply(&json!({"type":"move","uci":"e2e5"})).is_err());
        for m in ["f2f3", "e7e5", "g2g4", "d8h4"] {
            g.apply(&json!({"type":"move","uci":m})).unwrap();
        }
        assert!(g.view()["result"]
            .as_str()
            .unwrap()
            .contains("BlackCheckmates"));
        assert!(g.apply(&json!({"type":"move","uci":"a2a3"})).is_err());
    }
    #[test]
    fn castling_en_passant_promotion() {
        for (fen, mv) in [
            ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"),
            ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6"),
            ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n"),
        ] {
            let b = chess::Board::from_str(fen).unwrap();
            assert!(MoveGen::new_legal(&b).any(|m| m.to_string() == mv));
        }
    }
    #[test]
    fn repetition_survives_snapshot() {
        let mut g = Game::default();
        for m in [
            "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8",
        ] {
            g.apply(&json!({"type":"move","uci":m})).unwrap();
        }
        let mut restored: Game = serde_json::from_slice(&serde_json::to_vec(&g).unwrap()).unwrap();
        restored.apply(&json!({"type":"claim_draw"})).unwrap();
        assert_eq!(restored.view()["result"], "Draw claimed");
    }
}
