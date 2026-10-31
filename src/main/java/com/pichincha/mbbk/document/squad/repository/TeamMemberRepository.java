package com.pichincha.mbbk.document.squad.repository;

import com.pichincha.mbbk.document.squad.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface TeamMemberRepository extends JpaRepository<TeamMember, UUID> {

    List<TeamMember> findAllByOrderByOrdenAsc();

    @Query("select coalesce(max(t.orden), 0) from TeamMember t")
    int findMaxOrden();

    boolean existsByOrdenAndIdNot(Integer orden, UUID id);

    boolean existsByOrden(Integer orden);

    boolean existsByCorreoIgnoreCaseAndIdNot(String correo, UUID id);

    boolean existsByCorreoIgnoreCase(String correo);
}
