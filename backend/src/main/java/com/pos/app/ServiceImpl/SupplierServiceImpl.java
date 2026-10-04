package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import com.pos.app.DTO.CreateSupplierDTO;
import com.pos.app.Entity.Supplier;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.SupplierRepository;
import com.pos.app.Service.ISupplierService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SupplierServiceImpl implements ISupplierService {

    private final SupplierRepository repo;

    @Override
    public ResponseEntity<?> listAll() {
        return ResponseEntity.ok(repo.findByIsActiveTrueOrderBySupplierNameAsc());
    }

    @Override
    public ResponseEntity<?> create(CreateSupplierDTO dto) {
        if (dto.getSupplierName() == null || dto.getSupplierName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Supplier name is required"));
        }
        Supplier s = new Supplier();
        s.setSupplierName(dto.getSupplierName().trim());
        s.setPhone(dto.getPhone());
        s.setEmail(dto.getEmail());
        s.setAddress(dto.getAddress());
        s.setGstNumber(dto.getGstNumber());
        s.setIsActive(true);
        return ResponseEntity.ok(repo.save(s));
    }

    @Override
    public ResponseEntity<?> update(Long supplierId, CreateSupplierDTO dto) {
        Supplier s = repo.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Supplier not found"));
        if (dto.getSupplierName() != null && !dto.getSupplierName().isBlank()) s.setSupplierName(dto.getSupplierName().trim());
        if (dto.getPhone() != null) s.setPhone(dto.getPhone());
        if (dto.getEmail() != null) s.setEmail(dto.getEmail());
        if (dto.getAddress() != null) s.setAddress(dto.getAddress());
        if (dto.getGstNumber() != null) s.setGstNumber(dto.getGstNumber());
        s.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(repo.save(s));
    }

    @Override
    public ResponseEntity<?> toggleActive(Long supplierId, Boolean isActive) {
        Supplier s = repo.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Supplier not found"));
        s.setIsActive(isActive != null ? isActive : true);
        return ResponseEntity.ok(repo.save(s));
    }

    @Override
    public ResponseEntity<?> searchPaged(int page, int size, String search, Boolean active, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "supplierName";
        Sort.Direction dir = sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
                ? Sort.Direction.DESC : Sort.Direction.ASC;

        var result = repo.search(search, active, PageRequest.of(PageGuard.page(page), PageGuard.size(size), Sort.by(dir, sortField)));

        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size
        ));
    }
}
