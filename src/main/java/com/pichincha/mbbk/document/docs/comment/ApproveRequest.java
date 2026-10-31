package com.pichincha.mbbk.document.docs.comment;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.UUID;

public record ApproveRequest(
        @JsonAlias({"userId", "usuario"})
        UUID usuarioId,
        @JsonAlias({"username", "github"})
        String githubUsername
) {
}
