package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.ReminderRequest;
import com.wliant.brainbook.dto.ReminderResponse;
import com.wliant.brainbook.model.RecurrencePattern;
import com.wliant.brainbook.model.ReminderType;
import com.wliant.brainbook.repository.ReminderRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ReminderServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ReminderService reminderService;

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID neuronId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        var chain = testDataFactory.createFullChain();
        neuronId = chain.neuron().id();
    }

    @Test
    void create_savesReminder() {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null);

        ReminderResponse response = reminderService.create(neuronId, req);

        assertThat(response.id()).isNotNull();
        assertThat(response.neuronId()).isEqualTo(neuronId);
        assertThat(response.reminderType()).isEqualTo(ReminderType.ONCE);
        assertThat(response.isActive()).isTrue();
        assertThat(response.title()).isNull();
        assertThat(response.description()).isNull();
    }

    @Test
    void create_savesReminderWithTitleAndDescription() {
        String descJson = "{\"type\":\"doc\",\"content\":[]}";
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, "My Reminder", descJson, "plain text");

        ReminderResponse response = reminderService.create(neuronId, req);

        assertThat(response.title()).isEqualTo("My Reminder");
        assertThat(response.description()).isEqualTo(descJson);
        assertThat(response.descriptionText()).isEqualTo("plain text");
    }

    @Test
    void create_throwsWhenTriggerAtIsInPast() {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().minusDays(1),
                null, null, null, null, null);

        assertThatThrownBy(() -> reminderService.create(neuronId, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("future");
    }

    @Test
    void create_throwsWhenNeuronNotFound() {
        ReminderRequest req = new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null);

        assertThatThrownBy(() -> reminderService.create(UUID.randomUUID(), req))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void listByNeuronId_returnsRemindersForNeuron() {
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, "First", null, null));
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(2),
                null, null, "Second", null, null));

        List<ReminderResponse> result = reminderService.listByNeuronId(neuronId);

        assertThat(result).hasSize(2);
    }

    @Test
    void listByNeuronId_returnsEmptyForOtherNeuron() {
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null));

        var otherChain = testDataFactory.createFullChain();
        List<ReminderResponse> result = reminderService.listByNeuronId(otherChain.neuron().id());

        assertThat(result).isEmpty();
    }

    @Test
    void listAll_returnsAllActiveRemindersWithNeuronTitle() {
        var chain2 = testDataFactory.createFullChain();
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null));
        reminderService.create(chain2.neuron().id(), new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(2),
                null, null, null, null, null));

        List<ReminderResponse> result = reminderService.listAll();

        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(r -> assertThat(r.neuronTitle()).isNotNull());
    }

    @Test
    void listAll_orderedByTriggerAtAscending() {
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(5),
                null, null, "Later", null, null));
        reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, "Earlier", null, null));

        List<ReminderResponse> result = reminderService.listAll();

        assertThat(result.get(0).title()).isEqualTo("Earlier");
        assertThat(result.get(1).title()).isEqualTo("Later");
    }

    @Test
    void update_updatesSchedulingAndTitleFields() {
        ReminderResponse created = reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, "Old Title", null, null));

        ReminderResponse updated = reminderService.update(created.id(), new ReminderRequest(
                ReminderType.RECURRING, LocalDateTime.now().plusDays(2),
                RecurrencePattern.DAILY, 1, "New Title", null, null));

        assertThat(updated.title()).isEqualTo("New Title");
        assertThat(updated.reminderType()).isEqualTo(ReminderType.RECURRING);
        assertThat(updated.recurrencePattern()).isEqualTo(RecurrencePattern.DAILY);
    }

    @Test
    void update_updatesDescription() {
        ReminderResponse created = reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null));
        String newDesc = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";

        ReminderResponse updated = reminderService.update(created.id(), new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, newDesc, "paragraph text"));

        assertThat(updated.description()).isEqualTo(newDesc);
        assertThat(updated.descriptionText()).isEqualTo("paragraph text");
    }

    @Test
    void delete_removesReminder() {
        ReminderResponse created = reminderService.create(neuronId, new ReminderRequest(
                ReminderType.ONCE, LocalDateTime.now().plusDays(1),
                null, null, null, null, null));

        reminderService.delete(created.id());

        assertThat(reminderRepository.findById(created.id())).isEmpty();
    }

    @Test
    void delete_throwsWhenReminderNotFound() {
        assertThatThrownBy(() -> reminderService.delete(UUID.randomUUID()))
                .isInstanceOf(RuntimeException.class);
    }
}
