package com.pichincha.mbbk.document.user.controller;

import com.pichincha.mbbk.document.config.AppConfig;
import com.pichincha.mbbk.document.user.dto.UserResponse;
import com.pichincha.mbbk.document.catalog.exception.InvalidCatalogException;
import com.pichincha.mbbk.document.user.exception.DuplicateUserException;
import com.pichincha.mbbk.document.user.exception.UserNotFoundException;
import com.pichincha.mbbk.document.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = UserController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class UserControllerTest {

    private static final String VALID_BODY = """
            {
              "githubUsername": "kquispe",
              "email": "kevin@pichincha.pe",
              "password": "secreto123",
              "nombre": "Kevin",
              "rol": "Software engineer",
              "squad": "Célula Canales Digitales"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    private final UUID id = UUID.randomUUID();

    private UserResponse response() {
        OffsetDateTime now = OffsetDateTime.now();
        return new UserResponse(id, "kquispe", "kevin@pichincha.pe", "Kevin",
                "Software engineer", "Célula Canales Digitales", "kquispe", now, now);
    }

    @Test
    void createReturns201WithLocationAndWithoutPassword() throws Exception {
        when(userService.create(any())).thenReturn(response());

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/v1/usuarios/" + id))
                .andExpect(jsonPath("$.githubUsername").value("kquispe"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void createReturns400WhenInvalid() throws Exception {
        String body = """
                {"githubUsername": "", "email": "no-es-correo", "password": "123",
                 "nombre": "", "rol": "", "squad": ""}
                """;

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void createReturns409WhenDuplicate() throws Exception {
        when(userService.create(any())).thenThrow(new DuplicateUserException("El correo ya está registrado"));

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("El correo ya está registrado"));
    }

    @Test
    void createReturns409OnIntegrityViolation() throws Exception {
        when(userService.create(any())).thenThrow(new DataIntegrityViolationException("dup"));

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isConflict());
    }

    @Test
    void createAcceptsFrontendAliases() throws Exception {
        when(userService.create(any())).thenReturn(response());
        String body = """
                {
                  "username": "pquispe-ext_pichper",
                  "email": "pquispe-ext@pichincha.pe",
                  "password": "secreto123",
                  "displayName": "Kevin",
                  "role": "Software engineer",
                  "squad": "Célula Canales Digitales"
                }
                """;

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void createReturns400WhenRoleIsUnknown() throws Exception {
        when(userService.create(any())).thenThrow(new InvalidCatalogException("Selecciona un rol válido"));

        mockMvc.perform(post("/api/v1/usuarios").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Selecciona un rol válido"));
    }

    @Test
    void findAllReturnsPage() throws Exception {
        when(userService.findAll(any())).thenReturn(new PageImpl<>(List.of(response()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/usuarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].email").value("kevin@pichincha.pe"))
                .andExpect(jsonPath("$.page.totalElements").value(1));
    }

    @Test
    void findByIdReturns404WhenMissing() throws Exception {
        when(userService.findById(id)).thenThrow(new UserNotFoundException(id));

        mockMvc.perform(get("/api/v1/usuarios/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void findByIdReturnsUser() throws Exception {
        when(userService.findById(id)).thenReturn(response());

        mockMvc.perform(get("/api/v1/usuarios/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.squad").value("Célula Canales Digitales"));
    }

    @Test
    void updateAllowsEmptyPassword() throws Exception {
        when(userService.update(eq(id), any())).thenReturn(response());
        String body = VALID_BODY.replace("secreto123", "");

        mockMvc.perform(put("/api/v1/usuarios/{id}", id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void updateProfileAllowsCorsPreflightFromPortal() throws Exception {
        mockMvc.perform(options("/api/v1/usuarios/{id}/perfil", id)
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PATCH")));
    }

    @Test
    void updateProfileReturnsOk() throws Exception {
        when(userService.updateProfile(eq(id), any())).thenReturn(response());
        String body = """
                {"githubUsername": "kevin29", "nombre": "Kevin Quispe", "email": "kquispe07@gmail.com", "perfilGithub": "kevin29"}
                """;

        mockMvc.perform(patch("/api/v1/usuarios/{id}/perfil", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfilPublico").value("kquispe"));
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/v1/usuarios/{id}", id))
                .andExpect(status().isNoContent());
        verify(userService).delete(id);
    }

    @Test
    void deleteReturns404WhenMissing() throws Exception {
        doThrow(new UserNotFoundException(id)).when(userService).delete(id);

        mockMvc.perform(delete("/api/v1/usuarios/{id}", id))
                .andExpect(status().isNotFound());
    }
}
