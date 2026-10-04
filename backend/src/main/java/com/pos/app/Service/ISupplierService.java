package com.pos.app.Service;

import com.pos.app.DTO.CreateSupplierDTO;
import org.springframework.http.ResponseEntity;

public interface ISupplierService {
    ResponseEntity<?> listAll();
    ResponseEntity<?> create(CreateSupplierDTO dto);
    ResponseEntity<?> update(Long supplierId, CreateSupplierDTO dto);
    ResponseEntity<?> toggleActive(Long supplierId, Boolean isActive);
    ResponseEntity<?> searchPaged(int page, int size, String search, Boolean active, String sort);
}
