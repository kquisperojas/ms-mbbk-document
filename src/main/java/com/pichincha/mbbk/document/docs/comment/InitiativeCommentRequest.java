package com.pichincha.mbbk.document.docs.comment;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record InitiativeCommentRequest(
        @JsonAlias({"userId", "usuario"})
        UUID usuarioId,
        @JsonAlias({"username", "github"})
        String githubUsername,
        @NotBlank(message = "Escribe el comentario")
        @Size(max = 2000, message = "El comentario no puede superar 2000 caracteres")
        @JsonAlias({"text", "comentario"})
        String texto
) {
}
