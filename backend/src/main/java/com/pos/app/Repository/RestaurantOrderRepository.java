package com.pos.app.Repository;

import com.pos.app.Entity.RestaurantOrder;
import com.pos.app.Enum.RestaurantOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantOrderRepository extends JpaRepository<RestaurantOrder, Long> {

    /** How many orders are still running -- shown as a warning when a cash shift is closed. */
    long countByStatusIn(java.util.Collection<RestaurantOrderStatus> statuses);

    Optional<RestaurantOrder> findByTable_TableIdAndStatusIn(Long tableId, List<RestaurantOrderStatus> statuses);

    List<RestaurantOrder> findByStatusInOrderByOpenedAtAsc(List<RestaurantOrderStatus> statuses);

    // ✅ Parcel/Online counter-orders board -- everything not tied to a table
    List<RestaurantOrder> findByOrderTypeInAndStatusInOrderByOpenedAtAsc(
            List<com.pos.app.Enum.OrderType> orderTypes, List<RestaurantOrderStatus> statuses);
}
