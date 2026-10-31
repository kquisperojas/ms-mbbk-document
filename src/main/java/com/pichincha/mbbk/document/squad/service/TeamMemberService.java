package com.pichincha.mbbk.document.squad.service;

import com.pichincha.mbbk.document.squad.dto.TeamMemberRequest;
import com.pichincha.mbbk.document.squad.dto.TeamMemberResponse;
import com.pichincha.mbbk.document.squad.entity.TeamMember;
import com.pichincha.mbbk.document.squad.exception.DuplicateTeamMemberException;
import com.pichincha.mbbk.document.squad.exception.TeamMemberNotFoundException;
import com.pichincha.mbbk.document.squad.repository.TeamMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.UUID;

@Service
public class TeamMemberService {

    private final TeamMemberRepository repository;

    public TeamMemberService(TeamMemberRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> findAll() {
        return repository.findAllByOrderByOrdenAsc().stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TeamMemberResponse findById(UUID id) {
        return TeamMemberResponse.from(getMember(id));
    }

    @Transactional
    public TeamMemberResponse create(TeamMemberRequest request) {
        TeamMember member = new TeamMember();
        apply(member, request, true);
        return TeamMemberResponse.from(repository.save(member));
    }

    @Transactional
    public TeamMemberResponse update(UUID id, TeamMemberRequest request) {
        TeamMember member = getMember(id);
        apply(member, request, false);
        return TeamMemberResponse.from(repository.save(member));
    }

    @Transactional
    public void delete(UUID id) {
        TeamMember member = getMember(id);
        repository.delete(member);
    }

    private TeamMember getMember(UUID id) {
        return repository.findById(id).orElseThrow(() -> new TeamMemberNotFoundException(id));
    }

    private void apply(TeamMember member, TeamMemberRequest request, boolean creating) {
        Integer orden = request.orden();
        if (orden == null) {
            orden = creating || member.getOrden() == null ? nextOrden() : member.getOrden();
        } else {
            boolean taken = creating
                    ? repository.existsByOrden(orden)
                    : repository.existsByOrdenAndIdNot(orden, member.getId());
            if (taken) {
                throw new DuplicateTeamMemberException("Ya existe un miembro con el número " + orden);
            }
        }
        String correo = normalize(request.correo());
        if (correo != null) {
            boolean taken = creating
                    ? repository.existsByCorreoIgnoreCase(correo)
                    : repository.existsByCorreoIgnoreCaseAndIdNot(correo, member.getId());
            if (taken) {
                throw new DuplicateTeamMemberException("El correo ya está registrado en el squad");
            }
        }
        member.setOrden(orden);
        member.setNombre(request.nombre().trim());
        member.setRol(request.rol().trim());
        member.setCorreo(correo);
        member.setNumero(normalize(request.numero()));
    }

    private int nextOrden() {
        return repository.findMaxOrden() + 1;
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
