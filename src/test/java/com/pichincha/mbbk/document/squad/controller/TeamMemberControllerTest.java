package com.pichincha.mbbk.document.squad.controller;

import com.pichincha.mbbk.document.config.AppConfig;
import com.pichincha.mbbk.document.squad.dto.TeamMemberResponse;
import com.pichincha.mbbk.document.squad.exception.DuplicateTeamMemberException;
import com.pichincha.mbbk.document.squad.exception.TeamMemberNotFoundException;
import com.pichincha.mbbk.document.squad.service.TeamMemberService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = TeamMemberController.class, properties = "app.cors.allowed-origins=http://localhost:4200")
@Import(AppConfig.class)
class TeamMemberControllerTest {

    private static final String VALID_BODY = """
            {
              "orden": 11,
              "nombre": "Maycol Meza",
              "rol": "Desarrollador móvil (Android)",
              "correo": "mmeza-ext@pichincha.pe",
              "numero": "999111222"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TeamMemberService service;

    private final UUID id = UUID.randomUUID();

    private TeamMemberResponse response() {
        OffsetDateTime now = OffsetDateTime.now();
        return new TeamMemberResponse(id, 11, "Maycol Meza", "Desarrollador móvil (Android)",
                "mmeza-ext@pichincha.pe", "999111222", now, now);
    }

    @Test
    void findAllReturnsMembers() throws Exception {
        when(service.findAll()).thenReturn(List.of(response()));

        mockMvc.perform(get("/api/v1/squad/members"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Maycol Meza"))
                .andExpect(jsonPath("$[0].orden").value(11));
    }

    @Test
    void findByIdReturnsMember() throws Exception {
        when(service.findById(id)).thenReturn(response());

        mockMvc.perform(get("/api/v1/squad/members/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correo").value("mmeza-ext@pichincha.pe"));
    }

    @Test
    void findByIdReturns404WhenMissing() throws Exception {
        when(service.findById(id)).thenThrow(new TeamMemberNotFoundException(id));

        mockMvc.perform(get("/api/v1/squad/members/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No existe el miembro del squad con id " + id));
    }

    @Test
    void createReturns201WithLocation() throws Exception {
        when(service.create(any())).thenReturn(response());

        mockMvc.perform(post("/api/v1/squad/members").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/v1/squad/members/" + id))
                .andExpect(jsonPath("$.nombre").value("Maycol Meza"));
    }

    @Test
    void createReturns400WhenInvalid() throws Exception {
        String body = """
                {"nombre": "", "rol": "", "correo": "no-es-correo", "orden": 0}
                """;

        mockMvc.perform(post("/api/v1/squad/members").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.nombre").exists())
                .andExpect(jsonPath("$.errors.rol").exists())
                .andExpect(jsonPath("$.errors.correo").exists());
    }

    @Test
    void createReturns409WhenDuplicate() throws Exception {
        when(service.create(any())).thenThrow(new DuplicateTeamMemberException("El correo ya está registrado en el squad"));

        mockMvc.perform(post("/api/v1/squad/members").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("El correo ya está registrado en el squad"));
    }

    @Test
    void updateReturnsOk() throws Exception {
        when(service.update(eq(id), any())).thenReturn(response());

        mockMvc.perform(put("/api/v1/squad/members/{id}", id).contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("Desarrollador móvil (Android)"));
    }

    @Test
    void updateReturns404WhenMissing() throws Exception {
        when(service.update(eq(id), any())).thenThrow(new TeamMemberNotFoundException(id));

        mockMvc.perform(put("/api/v1/squad/members/{id}", id).contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/v1/squad/members/{id}", id))
                .andExpect(status().isNoContent());
        verify(service).delete(id);
    }

    @Test
    void deleteReturns404WhenMissing() throws Exception {
        doThrow(new TeamMemberNotFoundException(id)).when(service).delete(id);

        mockMvc.perform(delete("/api/v1/squad/members/{id}", id))
                .andExpect(status().isNotFound());
    }
}
