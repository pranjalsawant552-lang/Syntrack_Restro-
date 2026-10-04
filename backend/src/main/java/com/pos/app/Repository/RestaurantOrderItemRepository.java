package com.pos.app.Repository;

import com.pos.app.Entity.RestaurantOrderItem;
import com.pos.app.Enum.OrderItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RestaurantOrderItemRepository extends JpaRepository<RestaurantOrderItem, Long> {

    // ✅ Kitchen Display View: every item currently in the kitchen, across all tables/orders,
    // oldest first (so the kitchen naturally works front-to-back of the queue).
    List<RestaurantOrderItem> findByStatusOrderByOrderItemIdAsc(OrderItemStatus status);

    // ✅ Used by merge/settle instead of walking RestaurantOrder.getItems() in memory --
    // that collection has cascade/orphanRemoval semantics that make it easy to
    // accidentally delete a row just by moving it out of the collection. A plain
    // query sidesteps that entirely.
    List<RestaurantOrderItem> findByOrder_OrderIdAndBilledFalse(Long orderId);

    boolean existsByOrder_OrderIdAndBilledFalse(Long orderId);
}
