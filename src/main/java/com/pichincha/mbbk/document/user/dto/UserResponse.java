package com.pichincha.mbbk.document.user.dto;

import com.pichincha.mbbk.document.user.entity.User;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String githubUsername,
        String email,
        String nombre,
        String rol,
        String squad,
        String perfilPublico,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static UserResponse from(User user) {
        String publicProfile = user.getPerfilPublico();
        if (publicProfile == null || publicProfile.isBlank()) {
            publicProfile = user.getGithubUsername();
        }
        return new UserResponse(
                user.getId(),
                user.getGithubUsername(),
                user.getEmail(),
                user.getNombre(),
                user.getRol(),
                user.getSquad(),
                publicProfile,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
