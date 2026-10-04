package com.pos.app.DTO.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

/** Request/response shapes for kitchen stations, KOTs and item voids. */
public final class KotDTO {
    private KotDTO() {}

    public record StationRequest(@NotBlank @Size(max = 80) String name, @Size(max = 120) String printerName,
                                 Boolean isDefault, Boolean active) {}

    public record StationView(Long stationId, String name, String printerName, boolean isDefault, boolean active) {}

    public record ProductStationRequest(Long stationId) {}

    public record MappingView(Long productId, Long stationId) {}

    public record KotItemView(Long kotItemId, Long orderItemId, String productName, int quantity, String notes, String status) {}

    public record KotView(Long kotId, String kotNumber, Long orderId, Long stationId, String stationName,
                          String tableLabel, String orderType, String waiterName, String status,
                          LocalDateTime createdAt, long elapsedSeconds, List<KotItemView> items) {}

    public record VoidItemRequest(@NotBlank @Size(max = 200) String reason, String approverEmail, String approverPassword) {}
}
