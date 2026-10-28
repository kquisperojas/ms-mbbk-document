package com.pichincha.mbbk.document.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetRequest(
        @JsonAlias({"username", "usuarioGithub", "usuario"})
        @NotBlank
        String githubUsername,

        @JsonAlias({"password", "nuevaContrasena"})
        @NotBlank
        @Size(min = 8, max = 72)
        String newPassword
) {
}
