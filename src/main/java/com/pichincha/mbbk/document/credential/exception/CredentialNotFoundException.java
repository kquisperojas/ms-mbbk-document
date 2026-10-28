package com.pichincha.mbbk.document.credential.exception;

public class CredentialNotFoundException extends RuntimeException {

    public CredentialNotFoundException(String clave) {
        super("No existe la credencial " + clave);
    }
}
