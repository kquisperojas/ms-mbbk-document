package com.pichincha.mbbk.document.catalog.controller;

import com.pichincha.mbbk.document.catalog.entity.Role;
import com.pichincha.mbbk.document.catalog.entity.Squad;
import com.pichincha.mbbk.document.catalog.repository.RoleRepository;
import com.pichincha.mbbk.document.catalog.repository.SquadRepository;
import com.pichincha.mbbk.document.config.AppConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = CatalogController.class, properties = "app.cors.allowed-origins=http://localhost:5173")
@Import(AppConfig.class)
class CatalogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RoleRepository roleRepository;

    @MockitoBean
    private SquadRepository squadRepository;

    @Test
    void listsRoles() throws Exception {
        Role role = new Role();
        role.setId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        role.setNombre("Software engineer");
        when(roleRepository.findAllByOrderByNombreAsc()).thenReturn(List.of(role));

        mockMvc.perform(get("/api/v1/catalogos/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Software engineer"));
    }

    @Test
    void listsSquads() throws Exception {
        Squad squad = new Squad();
        squad.setId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        squad.setNombre("Célula Canales Digitales");
        when(squadRepository.findAllByOrderByNombreAsc()).thenReturn(List.of(squad));

        mockMvc.perform(get("/api/v1/catalogos/squads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Célula Canales Digitales"));
    }
}
