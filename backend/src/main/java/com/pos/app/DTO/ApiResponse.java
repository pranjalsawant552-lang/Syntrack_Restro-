// src/main/java/com/pos/app/DTO/ApiResponse.java
package com.pos.app.DTO;

import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
public class ApiResponse<T> {
    private boolean ok;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(String msg, T data){
        return new ApiResponse<>(true, msg, data);
    }
    public static <T> ApiResponse<T> fail(String msg){
        return new ApiResponse<>(false, msg, null);
    }
}
