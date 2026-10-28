package com.pichincha.mbbk.document.credential.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApiCredentialRequest(
        @NotBlank
        @Size(max = 50)
        String proveedor,

        @NotBlank
        @Size(max = 100)
        String clave,

        @NotBlank
        String valor,

        @Size(max = 255)
        String descripcion
) {
}
