package com.pos.app.Exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * The frontend grew up with two different conventions for reading an error
     * message off a failed response -- some pages check response.data.message,
     * others check response.data.error. Rather than that be a trap (whichever
     * key a handler picks, roughly half the frontend won't see it), every error
     * body includes both keys with the same value.
     */
    private static Map<String, Object> errorBody(String message) {
        String msg = message != null ? message : "Unknown error";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", msg);
        body.put("error", msg);
        return body;
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<?> handleInsufficient(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorBody(ex.getMessage()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<?> handleInvalidRequest(InvalidRequestException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorBody(ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundExceptionHandling.class)
    public ResponseEntity<?> handleNotFound(ResourceNotFoundExceptionHandling ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorBody(ex.getMessage()));
    }

    /**
     * Thrown by @PreAuthorize (and, in Spring Security 6, its subclass
     * AuthorizationDeniedException) when the logged-in user's role lacks the
     * required permission. This MUST stay a 403 with a clear message -- without
     * this handler it falls through to the generic 500 handler below, which is
     * exactly what was happening: every permission check failure, for any role,
     * anywhere in the app, was showing up to the user as a confusing 500 error.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        log.warn("Access denied on {}: {}", request.getDescription(false), ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(errorBody("You don't have permission to perform this action. Ask your admin to grant the required permission."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        Map<String, Object> body = errorBody("Validation failed");
        body.put("errors", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * A write was blocked by a database constraint (most commonly a foreign
     * key: trying to delete a row that other records still reference). This
     * is user-recoverable, so respond with 409 Conflict and a plain-English
     * message instead of the raw SQL/constraint name.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> handleDataIntegrity(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Data integrity violation on {}: {}", request.getDescription(false), ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(errorBody("This action can't be completed because the record is still linked to other data " +
                      "(e.g. invoices or transactions). Try deactivating it instead of deleting it."));
    }

    /**
     * Response serialization failed (e.g. an entity with an uninitialized lazy
     * association slipped through). Never expose internal class/proxy names
     * to the client.
     */
    @ExceptionHandler(HttpMessageNotWritableException.class)
    public ResponseEntity<?> handleNotWritable(HttpMessageNotWritableException ex, WebRequest request) {
        log.error("Failed to serialize response on {}: {}", request.getDescription(false), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorBody("Something went wrong while preparing the response. Please try again; " +
                      "if this keeps happening, contact support."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleAny(Exception ex, WebRequest request) {
        // Every previously-silent 500 in this app came from this handler swallowing the
        // real exception. Always log it — the HTTP response stays generic (don't leak
        // internals like SQL, entity/class names, or stack details to the client), but
        // the server log MUST have the real cause for debugging.
        log.error("Unhandled exception on {}: {}", request.getDescription(false), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorBody("Something went wrong on our end. Please try again; if this keeps happening, contact support."));
    }
}
