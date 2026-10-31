package com.pichincha.mbbk.document.squad.service;

import com.pichincha.mbbk.document.squad.dto.TeamMemberRequest;
import com.pichincha.mbbk.document.squad.dto.TeamMemberResponse;
import com.pichincha.mbbk.document.squad.entity.TeamMember;
import com.pichincha.mbbk.document.squad.exception.DuplicateTeamMemberException;
import com.pichincha.mbbk.document.squad.exception.TeamMemberNotFoundException;
import com.pichincha.mbbk.document.squad.repository.TeamMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamMemberServiceTest {

    @Mock
    private TeamMemberRepository repository;

    private TeamMemberService service;

    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TeamMemberService(repository);
    }

    private TeamMemberRequest request(Integer orden, String correo) {
        return new TeamMemberRequest(orden, " Maycol Meza ", "Desarrollador móvil (Android)", correo, " 999111222 ");
    }

    private TeamMember existing() {
        TeamMember member = new TeamMember();
        member.setId(id);
        member.setOrden(11);
        member.setNombre("Maycol Meza");
        member.setRol("Desarrollador móvil (Android)");
        member.setCorreo("mmeza-ext@pichincha.pe");
        member.setNumero(null);
        return member;
    }

    @Test
    void findAllMapsMembers() {
        when(repository.findAllByOrderByOrdenAsc()).thenReturn(List.of(existing()));

        List<TeamMemberResponse> rows = service.findAll();

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().nombre()).isEqualTo("Maycol Meza");
        assertThat(rows.getFirst().orden()).isEqualTo(11);
    }

    @Test
    void findByIdReturnsMember() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));

        assertThat(service.findById(id).correo()).isEqualTo("mmeza-ext@pichincha.pe");
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(id))
                .isInstanceOf(TeamMemberNotFoundException.class)
                .hasMessageContaining(id.toString());
    }

    @Test
    void createAssignsNextOrdenAndNormalizes() {
        when(repository.findMaxOrden()).thenReturn(15);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TeamMemberResponse created = service.create(request(null, "  MMeza-ext@pichincha.pe "));

        assertThat(created.orden()).isEqualTo(16);
        assertThat(created.nombre()).isEqualTo("Maycol Meza");
        assertThat(created.correo()).isEqualTo("MMeza-ext@pichincha.pe");
        assertThat(created.numero()).isEqualTo("999111222");
    }

    @Test
    void createRejectsDuplicateOrden() {
        when(repository.existsByOrden(11)).thenReturn(true);

        assertThatThrownBy(() -> service.create(request(11, "nuevo@pichincha.pe")))
                .isInstanceOf(DuplicateTeamMemberException.class)
                .hasMessageContaining("número 11");
    }

    @Test
    void createRejectsDuplicateCorreo() {
        when(repository.existsByCorreoIgnoreCase("mmeza-ext@pichincha.pe")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request(20, "mmeza-ext@pichincha.pe")))
                .isInstanceOf(DuplicateTeamMemberException.class)
                .hasMessageContaining("correo");
    }

    @Test
    void createAllowsBlankCorreoAndNumero() {
        when(repository.findMaxOrden()).thenReturn(0);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TeamMemberResponse created = service.create(new TeamMemberRequest(null, "Elderson Laborit",
                "Desarrollador móvil (iOS)", "  ", " "));

        assertThat(created.correo()).isNull();
        assertThat(created.numero()).isNull();
        assertThat(created.orden()).isEqualTo(1);
    }

    @Test
    void updateKeepsOrdenWhenOmitted() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TeamMemberResponse updated = service.update(id, request(null, "maycol.meza@pichincha.pe"));

        assertThat(updated.orden()).isEqualTo(11);
        assertThat(updated.correo()).isEqualTo("maycol.meza@pichincha.pe");
    }

    @Test
    void updateRejectsDuplicateOrdenOfAnotherMember() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));
        when(repository.existsByOrdenAndIdNot(3, id)).thenReturn(true);

        assertThatThrownBy(() -> service.update(id, request(3, "mmeza-ext@pichincha.pe")))
                .isInstanceOf(DuplicateTeamMemberException.class);
    }

    @Test
    void updateRejectsDuplicateCorreoOfAnotherMember() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));
        when(repository.existsByCorreoIgnoreCaseAndIdNot("ana.alegre@pichincha.pe", id)).thenReturn(true);

        assertThatThrownBy(() -> service.update(id, request(11, "ana.alegre@pichincha.pe")))
                .isInstanceOf(DuplicateTeamMemberException.class);
    }

    @Test
    void updateAllowsSameCorreo() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));
        when(repository.existsByCorreoIgnoreCaseAndIdNot("mmeza-ext@pichincha.pe", id)).thenReturn(false);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TeamMemberResponse updated = service.update(id, request(11, "mmeza-ext@pichincha.pe"));

        assertThat(updated.correo()).isEqualTo("mmeza-ext@pichincha.pe");
    }

    @Test
    void deleteRemovesMember() {
        when(repository.findById(id)).thenReturn(Optional.of(existing()));

        service.delete(id);

        verify(repository).delete(any(TeamMember.class));
    }

    @Test
    void deleteThrowsWhenMissing() {
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(id))
                .isInstanceOf(TeamMemberNotFoundException.class);
    }
}
