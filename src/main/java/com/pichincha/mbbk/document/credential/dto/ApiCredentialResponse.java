package com.pichincha.mbbk.document.credential.dto;

import com.pichincha.mbbk.document.credential.entity.ApiCredential;

import java.util.UUID;

public record ApiCredentialResponse(
        UUID id,
        String proveedor,
        String clave,
        String valor,
        String descripcion,
        boolean configurado
) {

    public static ApiCredentialResponse from(ApiCredential credential) {
        boolean configured = credential.getValor() != null && !credential.getValor().isBlank();
        return new ApiCredentialResponse(
                credential.getId(),
                credential.getProveedor(),
                credential.getClave(),
                mask(credential.getClave(), credential.getValor()),
                credential.getDescripcion(),
                configured
        );
    }

    static String mask(String clave, String valor) {
        if (valor == null || valor.isBlank()) {
            return "";
        }
        return isSecret(clave) ? "********" : valor;
    }

    static boolean isSecret(String clave) {
        String key = clave == null ? "" : clave.toUpperCase();
        return key.contains("TOKEN") || key.contains("SECRET") || key.contains("PASSWORD");
    }
}
