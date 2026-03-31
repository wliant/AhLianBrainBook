package com.wliant.brainbook.dto;

public record SearchResultItem(
        NeuronResponse neuron,
        String highlight,
        double rank
) {
}
