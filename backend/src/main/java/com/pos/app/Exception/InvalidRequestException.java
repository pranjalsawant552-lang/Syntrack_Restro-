package com.pos.app.Exception;

/**
 * Thrown for user-input validation failures that are discovered mid-transaction
 * (e.g. after stock has already been reserved for earlier items in the same
 * invoice). Being a RuntimeException means Spring's @Transactional rolls back
 * everything done so far in the surrounding transaction, unlike returning a
 * ResponseEntity directly, which would leave partial writes (stock movements,
 * the reserved invoice row) committed even though the request was rejected.
 */
public class InvalidRequestException extends RuntimeException {
    public InvalidRequestException(String message) {
        super(message);
    }
}
