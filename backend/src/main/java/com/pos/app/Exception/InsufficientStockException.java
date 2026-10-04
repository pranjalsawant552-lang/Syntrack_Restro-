package com.pos.app.Exception;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String msg) { super(msg); }
}
