package com.pichincha.mbbk.document.docs.comment;

import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.user.entity.User;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InitiativeCommentResponse(
        UUID id,
        String iniciativaKey,
        UUID usuarioId,
        UUID rolId,
        String author,
        String username,
        String role,
        String kind,
        String text,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static InitiativeCommentResponse from(InitiativeComment comment) {
        User user = comment.getUsuario();
        Role role = comment.getRol();
        String roleName = role != null ? role.getNombre() : (user != null ? user.getRol() : "");
        return new InitiativeCommentResponse(
                comment.getId(),
                comment.getIniciativaKey(),
                user != null ? user.getId() : null,
                role != null ? role.getId() : null,
                user != null ? user.getNombre() : "",
                user != null ? user.getGithubUsername() : "",
                roleName,
                InitiativeCommentService.kindFromRole(roleName),
                comment.getTexto(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }
}
