package com.pichincha.mbbk.document.docs.comment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.catalog.repository.RoleRepository;
import com.pichincha.mbbk.document.docs.DocumentationEngine;
import com.pichincha.mbbk.document.docs.DocumentationException;
import com.pichincha.mbbk.document.user.entity.User;
import com.pichincha.mbbk.document.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InitiativeCommentServiceTest {

    @Mock
    private InitiativeCommentRepository comments;
    @Mock
    private UserRepository users;
    @Mock
    private RoleRepository roles;
    @Mock
    private DocumentationEngine engine;

    private InitiativeCommentService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new InitiativeCommentService(comments, users, roles, engine, mapper);
    }

    @Test
    void approveRejectsNonTechLead() {
        UUID userId = UUID.randomUUID();
        User user = user(userId, "Software engineer");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(roles.findByNombreIgnoreCase("Software engineer")).thenReturn(Optional.of(role("Software engineer")));

        assertThatThrownBy(() -> service.approve("NEG-1678", new ApproveRequest(userId, null)))
                .isInstanceOf(DocumentationException.class)
                .hasMessageContaining("líder técnico");
        verify(engine, never()).run(eq("review-save"), any());
    }

    @Test
    void approvePersistsReviewWhenUserIsTechLead() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = user(userId, "Tech lead");
        Role role = role("Tech lead");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(roles.findByNombreIgnoreCase("Tech lead")).thenReturn(Optional.of(role));
        when(engine.run(eq("review-load"), any()))
                .thenReturn(mapper.readTree("{\"key\":\"NEG-1678\",\"status\":\"revision\",\"comments\":[]}"))
                .thenReturn(mapper.readTree("{\"key\":\"NEG-1678\",\"status\":\"publicada\",\"comments\":[]}"));
        when(engine.run(eq("review-save"), any()))
                .thenReturn(mapper.readTree("{\"key\":\"NEG-1678\",\"status\":\"publicada\"}"));
        when(comments.findByIniciativaKeyOrderByCreatedAtAsc("NEG-1678")).thenReturn(java.util.List.of());

        Map<String, Object> result = service.approve("neg-1678", new ApproveRequest(userId, null));

        assertThat(result.get("status")).isEqualTo("publicada");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> job = ArgumentCaptor.forClass(Map.class);
        verify(engine).run(eq("review-save"), job.capture());
        assertThat(job.getValue().get("key")).isEqualTo("NEG-1678");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) job.getValue().get("body");
        assertThat(body.get("status")).isEqualTo("publicada");
        assertThat(body.get("approvedByRole")).isEqualTo("Tech lead");
        assertThat(body.get("approvedByUserId")).isEqualTo(userId.toString());
    }

    @Test
    void createLinksCommentToUserAndRole() {
        UUID userId = UUID.randomUUID();
        User user = user(userId, "Tech lead");
        Role role = role("Tech lead");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(roles.findByNombreIgnoreCase("Tech lead")).thenReturn(Optional.of(role));
        when(comments.save(any(InitiativeComment.class))).thenAnswer(invocation -> {
            InitiativeComment saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        InitiativeCommentResponse response = service.create(
                "neg-1678", new InitiativeCommentRequest(userId, null, "  Falta el diagrama  "));

        assertThat(response.iniciativaKey()).isEqualTo("NEG-1678");
        assertThat(response.text()).isEqualTo("Falta el diagrama");
        assertThat(response.kind()).isEqualTo("lead");
        assertThat(response.usuarioId()).isEqualTo(userId);
        assertThat(response.rolId()).isEqualTo(role.getId());
        ArgumentCaptor<InitiativeComment> captor = ArgumentCaptor.forClass(InitiativeComment.class);
        verify(comments).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isSameAs(user);
        assertThat(captor.getValue().getRol()).isSameAs(role);
    }

    @Test
    void updateRejectsNonAuthor() {
        UUID authorId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID commentId = UUID.randomUUID();
        InitiativeComment comment = persistedComment(commentId, "NEG-1678", user(authorId, "Software engineer"));
        when(comments.findDetailedById(commentId)).thenReturn(Optional.of(comment));
        when(users.findById(otherId)).thenReturn(Optional.of(user(otherId, "Tech lead")));

        assertThatThrownBy(() -> service.update(
                "NEG-1678", commentId, new InitiativeCommentRequest(otherId, null, "texto nuevo")))
                .isInstanceOf(DocumentationException.class)
                .hasMessageContaining("autor");
        verify(comments, never()).save(any());
    }

    @Test
    void deleteRejectsTechLeadOnOthersComments() {
        UUID authorId = UUID.randomUUID();
        UUID leadId = UUID.randomUUID();
        UUID commentId = UUID.randomUUID();
        InitiativeComment comment = persistedComment(commentId, "NEG-1678", user(authorId, "Software engineer"));
        when(comments.findDetailedById(commentId)).thenReturn(Optional.of(comment));
        when(users.findById(leadId)).thenReturn(Optional.of(user(leadId, "Tech lead")));

        assertThatThrownBy(() -> service.delete("NEG-1678", commentId, leadId, null))
                .isInstanceOf(DocumentationException.class)
                .hasMessageContaining("autor");
        verify(comments, never()).delete(comment);
    }

    private static InitiativeComment persistedComment(UUID id, String key, User author) {
        InitiativeComment comment = new InitiativeComment();
        comment.setId(id);
        comment.setIniciativaKey(key);
        comment.setUsuario(author);
        comment.setTexto("original");
        return comment;
    }

    private static User user(UUID id, String rol) {
        User user = new User();
        user.setId(id);
        user.setGithubUsername("kquispe");
        user.setNombre("Kevin");
        user.setRol(rol);
        return user;
    }

    private static Role role(String nombre) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setNombre(nombre);
        return role;
    }
}
