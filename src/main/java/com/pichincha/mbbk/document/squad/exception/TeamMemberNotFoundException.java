package com.pichincha.mbbk.document.squad.exception;

import java.util.UUID;

public class TeamMemberNotFoundException extends RuntimeException {

    public TeamMemberNotFoundException(UUID id) {
        super("No existe el miembro del squad con id " + id);
    }
}
