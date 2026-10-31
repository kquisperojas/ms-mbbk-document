package com.pichincha.mbbk.document.docs.comment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.catalog.exception.InvalidCatalogException;
import com.pichincha.mbbk.document.catalog.repository.RoleRepository;
import com.pichincha.mbbk.document.docs.DocumentationEngine;
import com.pichincha.mbbk.document.docs.DocumentationException;
import com.pichincha.mbbk.document.user.entity.User;
import com.pichincha.mbbk.document.user.exception.UserNotFoundException;
import com.pichincha.mbbk.document.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class InitiativeCommentService {

    private final InitiativeCommentRepository comments;
    private final UserRepository users;
    private final RoleRepository roles;
    private final DocumentationEngine engine;
    private final ObjectMapper objectMapper;

    public InitiativeCommentService(
            InitiativeCommentRepository comments,
            UserRepository users,
            RoleRepository roles,
            DocumentationEngine engine,
            ObjectMapper objectMapper) {
        this.comments = comments;
        this.users = users;
        this.roles = roles;
        this.engine = engine;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> loadReview(String key) {
        String normalized = normalizeKey(key);
        JsonNode lifecycle = engine.run("review-load", Map.of("key", normalized));
        Map<String, Object> payload = objectMapper.convertValue(lifecycle, new TypeReference<>() {
        });
        payload.put("comments", list(normalized));
        return payload;
    }

    @Transactional(readOnly = true)
    public List<InitiativeCommentResponse> list(String key) {
        return comments.findByIniciativaKeyOrderByCreatedAtAsc(normalizeKey(key)).stream()
                .map(InitiativeCommentResponse::from)
                .toList();
    }

    @Transactional
    public InitiativeCommentResponse create(String key, InitiativeCommentRequest request) {
        String normalized = normalizeKey(key);
        User user = requireUser(request.usuarioId(), request.githubUsername());
        Role role = requireRole(user.getRol());
        InitiativeComment comment = new InitiativeComment();
        comment.setIniciativaKey(normalized);
        comment.setUsuario(user);
        comment.setRol(role);
        comment.setTexto(request.texto().trim());
        return InitiativeCommentResponse.from(comments.save(comment));
    }

    @Transactional
    public InitiativeCommentResponse update(String key, UUID commentId, InitiativeCommentRequest request) {
        InitiativeComment comment = requireComment(key, commentId);
        User actor = requireUser(request.usuarioId(), request.githubUsername());
        assertAuthor(comment, actor);
        comment.setTexto(request.texto().trim());
        comment.markUpdated();
        return InitiativeCommentResponse.from(comments.save(comment));
    }

    @Transactional
    public void delete(String key, UUID commentId, UUID usuarioId, String githubUsername) {
        InitiativeComment comment = requireComment(key, commentId);
        User actor = requireUser(usuarioId, githubUsername);
        if (!isAuthor(comment, actor)) {
            throw new DocumentationException(403, "Solo el autor puede eliminar el comentario.");
        }
        comments.delete(comment);
    }

    @Transactional
    public Map<String, Object> approve(String key, ApproveRequest request) {
        String normalized = normalizeKey(key);
        User user = requireUser(request.usuarioId(), request.githubUsername());
        Role role = requireRole(user.getRol());
        if (!isTechLead(user)) {
            throw new DocumentationException(403, "Solo el líder técnico puede aprobar la documentación.");
        }
        Map<String, Object> current = loadReview(normalized);
        String status = String.valueOf(current.getOrDefault("status", ""));
        if ("publicada".equals(status)) {
            throw new DocumentationException(409, "La documentación ya está publicada.");
        }
        if ("desactualizada".equals(status)) {
            throw new DocumentationException(400, "Completa diagramas y casos de prueba antes de aprobar.");
        }
        if ("borrador".equals(status)) {
            throw new DocumentationException(400, "Genera la documentación antes de aprobarla.");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "publicada");
        body.put("publishedAt", OffsetDateTime.now().toString());
        body.put("publishedBy", user.getNombre());
        body.put("approvedByUserId", user.getId().toString());
        body.put("approvedByRoleId", role.getId().toString());
        body.put("approvedByRole", role.getNombre());
        engine.run("review-save", Map.of("key", normalized, "body", body));
        return loadReview(normalized);
    }

    static String kindFromRole(String role) {
        return isTechLeadRole(role) ? "lead" : "owner";
    }

    static boolean isTechLead(User user) {
        return isTechLeadRole(user.getRol());
    }

    static boolean isTechLeadRole(String role) {
        String normalized = Normalizer.normalize(role == null ? "" : role, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .trim()
                .toLowerCase();
        return "tech lead".equals(normalized) || "lider tecnico".equals(normalized);
    }

    private String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            throw new DocumentationException(400, "Indica la clave de la iniciativa.");
        }
        return key.trim().toUpperCase();
    }

    private InitiativeComment requireComment(String key, UUID commentId) {
        InitiativeComment comment = comments.findDetailedById(commentId)
                .orElseThrow(() -> new DocumentationException(404, "No existe el comentario."));
        if (!comment.getIniciativaKey().equalsIgnoreCase(normalizeKey(key))) {
            throw new DocumentationException(404, "El comentario no pertenece a esta iniciativa.");
        }
        return comment;
    }

    private User requireUser(UUID usuarioId, String githubUsername) {
        if (usuarioId != null) {
            return users.findById(usuarioId).orElseGet(() -> requireUserByGithub(githubUsername));
        }
        return requireUserByGithub(githubUsername);
    }

    private User requireUserByGithub(String githubUsername) {
        if (githubUsername == null || githubUsername.isBlank()) {
            throw new UserNotFoundException("Indica el usuario de la sesión.");
        }
        return users.findByGithubUsernameIgnoreCase(githubUsername.trim())
                .orElseThrow(() -> new UserNotFoundException("No existe el usuario de la sesión."));
    }

    private Role requireRole(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new InvalidCatalogException("El usuario no tiene un rol válido.");
        }
        return roles.findByNombreIgnoreCase(nombre.trim())
                .orElseThrow(() -> new InvalidCatalogException("El rol del usuario no existe en catálogo."));
    }

    private void assertAuthor(InitiativeComment comment, User actor) {
        if (!isAuthor(comment, actor)) {
            throw new DocumentationException(403, "Solo el autor puede editar el comentario.");
        }
    }

    private boolean isAuthor(InitiativeComment comment, User actor) {
        return comment.getUsuario() != null && comment.getUsuario().getId().equals(actor.getId());
    }
}
