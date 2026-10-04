package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.DTO.CreateCustomerDTO;
import com.pos.app.Entity.Customer;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.CustomerRepository;
import com.pos.app.Service.ICustomerService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements ICustomerService {

    private final CustomerRepository repo;

    private String norm(String s) {
        return s == null ? "" : s.trim();
    }

    @Override
    public ResponseEntity<?> listAll() {
        // Capped: a busy restaurant collects thousands of customers. The Customers screen uses /search-paged instead.
        List<Customer> list = repo.findAll(org.springframework.data.domain.PageRequest.of(
                0, PageGuard.MAX_PAGE_SIZE, org.springframework.data.domain.Sort.by("customerName"))).getContent();
        return ResponseEntity.ok(list);
    }

    @Override
    public ResponseEntity<?> search(String q) {
        String s = norm(q);
        if (s.isEmpty()) {
            // quick-pick list for the billing customer picker: first 50 by name, not the whole table
            return ResponseEntity.ok(repo.findAll(org.springframework.data.domain.PageRequest.of(
                    0, 50, org.springframework.data.domain.Sort.by("customerName"))).getContent());
        }
        // phone digits ke liye same q use kar lo
        return ResponseEntity.ok(
                repo.findTop50ByCustomerNameContainingIgnoreCaseOrPhoneContainingOrEmailContainingIgnoreCase(s, s, s)
        );
    }

    @Override
    public ResponseEntity<?> create(CreateCustomerDTO dto) {
        String name = norm(dto.getCustomerName());
        if (name.isEmpty()) return ResponseEntity.badRequest().body("Customer name is required");

        Customer c = new Customer();
        c.setCustomerName(name);
        c.setPhone(norm(dto.getPhone()));
        c.setEmail(norm(dto.getEmail()));
        c.setAddress(norm(dto.getAddress()));
        c.setIsActive(true);

        return ResponseEntity.ok(repo.save(c));
    }

    @Override
    public ResponseEntity<?> update(Long customerId, CreateCustomerDTO dto) {
        Customer c = repo.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Customer not found"));

        String name = norm(dto.getCustomerName());
        if (name.isEmpty()) return ResponseEntity.badRequest().body("Customer name is required");

        c.setCustomerName(name);
        c.setPhone(norm(dto.getPhone()));
        c.setEmail(norm(dto.getEmail()));
        c.setAddress(norm(dto.getAddress()));

        return ResponseEntity.ok(repo.save(c));
    }

    @Override
    public ResponseEntity<?> toggleActive(Long customerId, Boolean isActive) {
        Customer c = repo.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Customer not found"));

        c.setIsActive(isActive != null ? isActive : true);
        return ResponseEntity.ok(repo.save(c));
    }

    @Override
    public ResponseEntity<?> searchPaged(int page, int size, String search, Boolean active, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "customerName";
        org.springframework.data.domain.Sort.Direction dir =
                sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
                        ? org.springframework.data.domain.Sort.Direction.DESC
                        : org.springframework.data.domain.Sort.Direction.ASC;

        org.springframework.data.domain.Page<Customer> result = repo.search(
                search, active,
                org.springframework.data.domain.PageRequest.of(PageGuard.page(page), PageGuard.size(size),
                        org.springframework.data.domain.Sort.by(dir, sortField)));

        return ResponseEntity.ok(java.util.Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size
        ));
    }
}