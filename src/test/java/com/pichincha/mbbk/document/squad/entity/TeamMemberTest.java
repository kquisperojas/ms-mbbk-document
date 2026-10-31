package com.pichincha.mbbk.document.squad.entity;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TeamMemberTest {

    @Test
    void onCreateAndOnUpdateStampTimestamps() {
        TeamMember member = new TeamMember();
        member.setId(UUID.randomUUID());
        member.setOrden(1);
        member.setNombre("Elderson Laborit");
        member.setRol("Desarrollador móvil (iOS)");
        member.onCreate();

        assertThat(member.getCreatedAt()).isNotNull();
        assertThat(member.getUpdatedAt()).isNotNull();
        assertThat(member.getCreatedAt()).isEqualTo(member.getUpdatedAt());

        member.onUpdate();
        assertThat(member.getUpdatedAt()).isAfterOrEqualTo(member.getCreatedAt());
    }
}
