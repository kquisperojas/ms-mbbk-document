package com.pichincha.mbbk.document.docs.comment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InitiativeCommentRepository extends JpaRepository<InitiativeComment, UUID> {

    @Query("""
            select c from InitiativeComment c
            join fetch c.usuario
            join fetch c.rol
            where c.iniciativaKey = :key
            order by c.createdAt asc
            """)
    List<InitiativeComment> findByIniciativaKeyOrderByCreatedAtAsc(@Param("key") String key);

    @Query("""
            select c from InitiativeComment c
            join fetch c.usuario
            join fetch c.rol
            where c.id = :id
            """)
    Optional<InitiativeComment> findDetailedById(@Param("id") UUID id);
}
