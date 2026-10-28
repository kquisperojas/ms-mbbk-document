package com.pichincha.mbbk.document.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @JsonAlias({"username", "usuarioGithub"})
        @NotBlank
        String githubUsername,

        @NotBlank
        String password
) {
}
