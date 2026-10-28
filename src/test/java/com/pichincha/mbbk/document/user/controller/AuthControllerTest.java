package com.pichincha.mbbk.document.user.controller;

import com.pichincha.mbbk.document.config.AppConfig;
import com.pichincha.mbbk.document.user.dto.UserResponse;
import com.pichincha.mbbk.document.user.exception.UserNotFoundException;
import com.pichincha.mbbk.document.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = AuthController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    private final UUID id = UUID.randomUUID();

    private UserResponse response() {
        OffsetDateTime now = OffsetDateTime.now();
        return new UserResponse(id, "admin", "admin@pichincha.pe", "Admin",
                "Administrador", "Célula Canales Digitales", "admin", now, now);
    }

    @Test
    void loginReturnsUser() throws Exception {
        when(userService.login(any())).thenReturn(response());
        String body = """
                {"githubUsername": "admin", "password": "admin1234"}
                """;

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.githubUsername").value("admin"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void resetPasswordReturnsOk() throws Exception {
        when(userService.resetPassword(any())).thenReturn(response());
        String body = """
                {"githubUsername": "admin", "newPassword": "nueva1234"}
                """;

        mockMvc.perform(post("/api/v1/auth/password").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.githubUsername").value("admin"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void resetPasswordAcceptsAliases() throws Exception {
        when(userService.resetPassword(any())).thenReturn(response());
        String body = """
                {"usuario": "admin", "password": "nueva1234"}
                """;

        mockMvc.perform(post("/api/v1/auth/password").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void resetPasswordReturns400WhenInvalid() throws Exception {
        String body = """
                {"githubUsername": "", "newPassword": "123"}
                """;

        mockMvc.perform(post("/api/v1/auth/password").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.newPassword").exists());
    }

    @Test
    void resetPasswordReturns404WhenMissing() throws Exception {
        when(userService.resetPassword(any())).thenThrow(new UserNotFoundException("admin"));

        mockMvc.perform(post("/api/v1/auth/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"githubUsername": "admin", "newPassword": "nueva1234"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No existe el usuario admin"));
    }
}
