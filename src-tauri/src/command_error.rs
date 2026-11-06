use serde::{Deserialize, Serialize};
use std::fmt;

/// Standardized native command error payload returned to the frontend shell.
/// Matches the architectural contract: `{ code: String, message: String, retryable: bool }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message, false)
    }

    pub fn auth_failed(message: impl Into<String>) -> Self {
        Self::new("AUTH_FAILED", message, false)
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::new("NETWORK_ERROR", message, true)
    }

    pub fn database(message: impl Into<String>) -> Self {
        Self::new("DATABASE_ERROR", message, true)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL_ERROR", message, false)
    }

    pub fn shell(message: impl Into<String>) -> Self {
        Self::new("SHELL_ERROR", message, false)
    }
}

impl fmt::Display for CommandError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

impl From<String> for CommandError {
    fn from(msg: String) -> Self {
        Self::shell(msg)
    }
}

impl From<&str> for CommandError {
    fn from(msg: &str) -> Self {
        Self::shell(msg)
    }
}

impl From<crate::error::AppError> for CommandError {
    fn from(err: crate::error::AppError) -> Self {
        let retryable = matches!(
            err,
            crate::error::AppError::Network(_) | crate::error::AppError::Database(_)
        );
        Self::new(err.code(), err.to_string(), retryable)
    }
}

impl From<sqlx::Error> for CommandError {
    fn from(err: sqlx::Error) -> Self {
        Self::database(err.to_string())
    }
}

impl From<std::io::Error> for CommandError {
    fn from(err: std::io::Error) -> Self {
        Self::new("IO_ERROR", err.to_string(), false)
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(err: anyhow::Error) -> Self {
        Self::internal(err.to_string())
    }
}

impl From<reqwest::Error> for CommandError {
    fn from(err: reqwest::Error) -> Self {
        Self::network(err.to_string())
    }
}

impl From<Box<dyn std::error::Error + Send + Sync>> for CommandError {
    fn from(err: Box<dyn std::error::Error + Send + Sync>) -> Self {
        Self::internal(err.to_string())
    }
}

#[cfg(test)]
#[path = "tests/command_error_tests.rs"]
mod tests;
