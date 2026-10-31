package com.pichincha.mbbk.document.squad.dto;

import com.pichincha.mbbk.document.squad.entity.TeamMember;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TeamMemberResponse(
        UUID id,
        Integer orden,
        String nombre,
        String rol,
        String correo,
        String numero,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static TeamMemberResponse from(TeamMember member) {
        return new TeamMemberResponse(
                member.getId(),
                member.getOrden(),
                member.getNombre(),
                member.getRol(),
                member.getCorreo(),
                member.getNumero(),
                member.getCreatedAt(),
                member.getUpdatedAt()
        );
    }
}
