package com.pichincha.mbbk.document.user.exception;

import java.util.UUID;

public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(UUID id) {
        super("No existe el usuario con id " + id);
    }

    public UserNotFoundException(String githubUsername) {
        super("No existe el usuario " + githubUsername);
    }
}
