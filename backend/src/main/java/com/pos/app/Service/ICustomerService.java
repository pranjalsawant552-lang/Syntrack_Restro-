package com.pos.app.Service;

import com.pos.app.DTO.CreateCustomerDTO;
import org.springframework.http.ResponseEntity;

public interface ICustomerService {
    ResponseEntity<?> listAll();
    ResponseEntity<?> search(String q);
    ResponseEntity<?> create(CreateCustomerDTO dto);
    ResponseEntity<?> update(Long customerId, CreateCustomerDTO dto);
    ResponseEntity<?> toggleActive(Long customerId, Boolean isActive);

    ResponseEntity<?> searchPaged(int page, int size, String search, Boolean active, String sort);
}
