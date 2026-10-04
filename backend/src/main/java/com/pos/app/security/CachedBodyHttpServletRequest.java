package com.pos.app.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.util.StreamUtils;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Unlike {@link org.springframework.web.util.ContentCachingRequestWrapper}, this wrapper
 * reads the body ONCE up front and always serves subsequent reads from that cached copy —
 * so a filter can inspect the body (e.g. to rate-limit by email) and still let the actual
 * controller read it in full afterwards. ContentCachingRequestWrapper does NOT support
 * this: its getInputStream() re-wraps the (by then exhausted) underlying stream on every
 * call, which silently empties the request body for anything downstream.
 */
public class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {

    private final byte[] cachedBody;

    public CachedBodyHttpServletRequest(HttpServletRequest request) throws IOException {
        super(request);
        this.cachedBody = StreamUtils.copyToByteArray(request.getInputStream());
    }

    public String getBodyAsString() {
        return new String(cachedBody, StandardCharsets.UTF_8);
    }

    @Override
    public ServletInputStream getInputStream() {
        return new CachedBodyServletInputStream(cachedBody);
    }

    @Override
    public BufferedReader getReader() {
        return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(cachedBody), StandardCharsets.UTF_8));
    }

    private static class CachedBodyServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream buffer;

        CachedBodyServletInputStream(byte[] cachedBody) {
            this.buffer = new ByteArrayInputStream(cachedBody);
        }

        @Override
        public boolean isFinished() {
            return buffer.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            // no-op: this is a fully-buffered, synchronous stream
        }

        @Override
        public int read() {
            return buffer.read();
        }
    }
}
