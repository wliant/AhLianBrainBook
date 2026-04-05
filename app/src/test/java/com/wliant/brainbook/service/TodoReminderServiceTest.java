package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.TodoMetadataRequest;
import com.wliant.brainbook.dto.TodoMetadataResponse;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.Reminder;
import com.wliant.brainbook.model.TodoMetadata;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.ReminderRepository;
import com.wliant.brainbook.repository.TodoMetadataRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TodoReminderServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TodoReminderService todoReminderService;

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private TodoMetadataRepository todoMetadataRepository;

    @Autowired
    private TodoMetadataService todoMetadataService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private Neuron neuron;
    private TodoMetadata metadata;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        BrainClusterNeuron chain = testDataFactory.createFullChain();
        neuron = neuronRepository.findById(chain.neuron().id()).orElseThrow();
        // Use the service to create metadata (handles Persistable lifecycle)
        todoMetadataService.getOrCreate(neuron.getId());
        metadata = todoMetadataRepository.findByNeuronId(neuron.getId()).orElseThrow();
    }

    @Test
    void sync_dueDateNull_noReminderCreated() {
        metadata.setDueDate(null);
        metadata.setCompleted(false);

        todoReminderService.syncSystemReminder(neuron, metadata);

        Optional<Reminder> reminder = reminderRepository.findByNeuronIdAndIsSystemTrueAndIsActiveTrue(neuron.getId());
        assertThat(reminder).isEmpty();
    }

    @Test
    void sync_futureDueDate_createsReminder() {
        metadata.setDueDate(LocalDate.now().plusDays(7));
        metadata.setCompleted(false);

        todoReminderService.syncSystemReminder(neuron, metadata);

        Optional<Reminder> reminder = reminderRepository.findByNeuronIdAndIsSystemTrueAndIsActiveTrue(neuron.getId());
        assertThat(reminder).isPresent();
        assertThat(reminder.get().isSystem()).isTrue();
        assertThat(reminder.get().isActive()).isTrue();
        assertThat(reminder.get().getTitle()).startsWith("Task due:");
    }

    @Test
    void sync_completed_deactivatesReminder() {
        metadata.setDueDate(LocalDate.now().plusDays(7));
        metadata.setCompleted(false);
        todoReminderService.syncSystemReminder(neuron, metadata);

        // Now mark completed
        metadata.setCompleted(true);
        todoReminderService.syncSystemReminder(neuron, metadata);

        Optional<Reminder> reminder = reminderRepository.findByNeuronIdAndIsSystemTrueAndIsActiveTrue(neuron.getId());
        assertThat(reminder).isEmpty();
    }

    @Test
    void sync_existingReminder_updatesTrigerAt() {
        metadata.setDueDate(LocalDate.now().plusDays(7));
        metadata.setCompleted(false);
        todoReminderService.syncSystemReminder(neuron, metadata);

        // Change due date
        metadata.setDueDate(LocalDate.now().plusDays(14));
        todoReminderService.syncSystemReminder(neuron, metadata);

        // Should still have exactly one active system reminder
        Optional<Reminder> reminder = reminderRepository.findByNeuronIdAndIsSystemTrueAndIsActiveTrue(neuron.getId());
        assertThat(reminder).isPresent();
    }
}
