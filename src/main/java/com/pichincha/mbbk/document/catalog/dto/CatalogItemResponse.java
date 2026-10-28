package com.pichincha.mbbk.document.catalog.dto;

import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.catalog.entity.Squad;

import java.util.UUID;

public record CatalogItemResponse(UUID id, String nombre) {

    public static CatalogItemResponse from(Role role) {
        return new CatalogItemResponse(role.getId(), role.getNombre());
    }

    public static CatalogItemResponse from(Squad squad) {
        return new CatalogItemResponse(squad.getId(), squad.getNombre());
    }
}
