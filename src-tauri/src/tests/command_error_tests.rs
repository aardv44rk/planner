use super::*;

#[test]
fn test_command_error_serialization() {
    let err = CommandError::network("Moodle gateway connection refused");
    assert_eq!(err.code, "NETWORK_ERROR");
    assert!(err.retryable);

    let json = serde_json::to_string(&err).expect("Failed to serialize CommandError");
    assert!(json.contains("\"code\":\"NETWORK_ERROR\""));
    assert!(json.contains("\"retryable\":true"));
}

#[test]
fn test_command_error_conversions() {
    let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found on disk");
    let cmd_err: CommandError = io_err.into();
    assert_eq!(cmd_err.code, "IO_ERROR");
    assert!(!cmd_err.retryable);

    let str_err: CommandError = "manual error string".into();
    assert_eq!(str_err.code, "SHELL_ERROR");
    assert_eq!(str_err.message, "manual error string");
}

#[test]
fn test_not_found_and_auth_are_not_retryable() {
    let not_found = CommandError::not_found("Course does not exist");
    assert!(!not_found.retryable);

    let auth = CommandError::auth_failed("Invalid Extic Matrix token");
    assert!(!auth.retryable);
    assert_eq!(auth.code, "AUTH_FAILED");
}
