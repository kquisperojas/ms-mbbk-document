package com.pichincha.mbbk.document.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code password} es opcional: si viene vacío o nulo se conserva la contraseña actual.
 */
public record UserUpdateRequest(
        @JsonAlias({"username", "usuarioGithub"})
        @NotBlank
        @Size(min = 2, max = 39)
        @Pattern(regexp = "^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$",
                message = "solo admite letras, números, puntos, guiones y guiones bajos")
        String githubUsername,

        @NotBlank
        @Email
        @Size(max = 150)
        String email,

        @Pattern(regexp = "^$|^.{8,72}$", message = "debe tener entre 8 y 72 caracteres")
        String password,

        @JsonAlias({"displayName", "name"})
        @NotBlank
        @Size(max = 150)
        String nombre,

        @JsonAlias("role")
        @NotBlank
        @Size(max = 100)
        String rol,

        @NotBlank
        @Size(max = 150)
        String squad,

        @Size(max = 39)
        @Pattern(regexp = "^$|^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$",
                message = "solo admite letras, números, puntos, guiones y guiones bajos")
        String perfilPublico
) {
}
