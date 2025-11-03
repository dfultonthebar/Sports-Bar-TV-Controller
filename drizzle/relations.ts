import { relations } from "drizzle-orm/relations";
import { globalCacheDevice, globalCachePort, irDevice, irCommand, matrixConfiguration, matrixInput, matrixOutput, tvProvider, providerInput, schedule, scheduleLog, fireTvDevice, audioZone, soundtrackPlayer, soundtrackConfig, todo, todoDocument, audioProcessor, aiGainAdjustmentLog, aiGainConfiguration, atlasConnectionState, atlasMeterReading, atlasParameter, audioInputMeter, audioMessage, audioScene, audioGroup, fireCubeDevice, fireCubeApp, fireCubeKeepAwakeLog, fireCubeSideloadOperation, fireCubeSportsContent, homeTeam, sportsEvent, cecDevice, cableBox, cecCommandLog } from "./schema";

export const globalCachePortRelations = relations(globalCachePort, ({one}) => ({
	globalCacheDevice: one(globalCacheDevice, {
		fields: [globalCachePort.deviceId],
		references: [globalCacheDevice.id]
	}),
}));

export const globalCacheDeviceRelations = relations(globalCacheDevice, ({many}) => ({
	globalCachePorts: many(globalCachePort),
}));

export const irCommandRelations = relations(irCommand, ({one}) => ({
	irDevice: one(irDevice, {
		fields: [irCommand.deviceId],
		references: [irDevice.id]
	}),
}));

export const irDeviceRelations = relations(irDevice, ({many}) => ({
	irCommands: many(irCommand),
}));

export const matrixInputRelations = relations(matrixInput, ({one}) => ({
	matrixConfiguration: one(matrixConfiguration, {
		fields: [matrixInput.configId],
		references: [matrixConfiguration.id]
	}),
}));

export const matrixConfigurationRelations = relations(matrixConfiguration, ({many}) => ({
	matrixInputs: many(matrixInput),
	matrixOutputs: many(matrixOutput),
}));

export const matrixOutputRelations = relations(matrixOutput, ({one}) => ({
	matrixConfiguration: one(matrixConfiguration, {
		fields: [matrixOutput.configId],
		references: [matrixConfiguration.id]
	}),
}));

export const providerInputRelations = relations(providerInput, ({one}) => ({
	tvProvider: one(tvProvider, {
		fields: [providerInput.providerId],
		references: [tvProvider.id]
	}),
}));

export const tvProviderRelations = relations(tvProvider, ({many}) => ({
	providerInputs: many(providerInput),
}));

export const scheduleLogRelations = relations(scheduleLog, ({one}) => ({
	schedule: one(schedule, {
		fields: [scheduleLog.scheduleId],
		references: [schedule.id]
	}),
}));

export const scheduleRelations = relations(schedule, ({one, many}) => ({
	scheduleLogs: many(scheduleLog),
	fireTvDevice: one(fireTvDevice, {
		fields: [schedule.deviceId],
		references: [fireTvDevice.id]
	}),
}));

export const fireTvDeviceRelations = relations(fireTvDevice, ({many}) => ({
	schedules: many(schedule),
}));

export const soundtrackPlayerRelations = relations(soundtrackPlayer, ({one}) => ({
	audioZone: one(audioZone, {
		fields: [soundtrackPlayer.audioZoneId],
		references: [audioZone.id]
	}),
	soundtrackConfig: one(soundtrackConfig, {
		fields: [soundtrackPlayer.configId],
		references: [soundtrackConfig.id]
	}),
}));

export const audioZoneRelations = relations(audioZone, ({one, many}) => ({
	soundtrackPlayers: many(soundtrackPlayer),
	audioProcessor: one(audioProcessor, {
		fields: [audioZone.processorId],
		references: [audioProcessor.id]
	}),
}));

export const soundtrackConfigRelations = relations(soundtrackConfig, ({many}) => ({
	soundtrackPlayers: many(soundtrackPlayer),
}));

export const todoDocumentRelations = relations(todoDocument, ({one}) => ({
	todo: one(todo, {
		fields: [todoDocument.todoId],
		references: [todo.id]
	}),
}));

export const todoRelations = relations(todo, ({many}) => ({
	todoDocuments: many(todoDocument),
}));

export const aiGainAdjustmentLogRelations = relations(aiGainAdjustmentLog, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [aiGainAdjustmentLog.processorId],
		references: [audioProcessor.id]
	}),
	aiGainConfiguration: one(aiGainConfiguration, {
		fields: [aiGainAdjustmentLog.configId],
		references: [aiGainConfiguration.id]
	}),
}));

export const audioProcessorRelations = relations(audioProcessor, ({many}) => ({
	aiGainAdjustmentLogs: many(aiGainAdjustmentLog),
	aiGainConfigurations: many(aiGainConfiguration),
	atlasConnectionStates: many(atlasConnectionState),
	atlasMeterReadings: many(atlasMeterReading),
	atlasParameters: many(atlasParameter),
	audioInputMeters: many(audioInputMeter),
	audioMessages: many(audioMessage),
	audioScenes: many(audioScene),
	audioZones: many(audioZone),
	audioGroups: many(audioGroup),
}));

export const aiGainConfigurationRelations = relations(aiGainConfiguration, ({one, many}) => ({
	aiGainAdjustmentLogs: many(aiGainAdjustmentLog),
	audioProcessor: one(audioProcessor, {
		fields: [aiGainConfiguration.processorId],
		references: [audioProcessor.id]
	}),
}));

export const atlasConnectionStateRelations = relations(atlasConnectionState, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [atlasConnectionState.processorId],
		references: [audioProcessor.id]
	}),
}));

export const atlasMeterReadingRelations = relations(atlasMeterReading, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [atlasMeterReading.processorId],
		references: [audioProcessor.id]
	}),
}));

export const atlasParameterRelations = relations(atlasParameter, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [atlasParameter.processorId],
		references: [audioProcessor.id]
	}),
}));

export const audioInputMeterRelations = relations(audioInputMeter, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [audioInputMeter.processorId],
		references: [audioProcessor.id]
	}),
}));

export const audioMessageRelations = relations(audioMessage, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [audioMessage.processorId],
		references: [audioProcessor.id]
	}),
}));

export const audioSceneRelations = relations(audioScene, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [audioScene.processorId],
		references: [audioProcessor.id]
	}),
}));

export const audioGroupRelations = relations(audioGroup, ({one}) => ({
	audioProcessor: one(audioProcessor, {
		fields: [audioGroup.processorId],
		references: [audioProcessor.id]
	}),
}));

export const fireCubeAppRelations = relations(fireCubeApp, ({one, many}) => ({
	fireCubeDevice: one(fireCubeDevice, {
		fields: [fireCubeApp.deviceId],
		references: [fireCubeDevice.id]
	}),
	fireCubeSportsContents: many(fireCubeSportsContent),
}));

export const fireCubeDeviceRelations = relations(fireCubeDevice, ({many}) => ({
	fireCubeApps: many(fireCubeApp),
	fireCubeKeepAwakeLogs: many(fireCubeKeepAwakeLog),
	fireCubeSideloadOperations: many(fireCubeSideloadOperation),
	fireCubeSportsContents: many(fireCubeSportsContent),
}));

export const fireCubeKeepAwakeLogRelations = relations(fireCubeKeepAwakeLog, ({one}) => ({
	fireCubeDevice: one(fireCubeDevice, {
		fields: [fireCubeKeepAwakeLog.deviceId],
		references: [fireCubeDevice.id]
	}),
}));

export const fireCubeSideloadOperationRelations = relations(fireCubeSideloadOperation, ({one}) => ({
	fireCubeDevice: one(fireCubeDevice, {
		fields: [fireCubeSideloadOperation.sourceDeviceId],
		references: [fireCubeDevice.id]
	}),
}));

export const fireCubeSportsContentRelations = relations(fireCubeSportsContent, ({one}) => ({
	fireCubeDevice: one(fireCubeDevice, {
		fields: [fireCubeSportsContent.deviceId],
		references: [fireCubeDevice.id]
	}),
	fireCubeApp: one(fireCubeApp, {
		fields: [fireCubeSportsContent.appId],
		references: [fireCubeApp.id]
	}),
}));

export const sportsEventRelations = relations(sportsEvent, ({one}) => ({
	homeTeam: one(homeTeam, {
		fields: [sportsEvent.homeTeamId],
		references: [homeTeam.id]
	}),
}));

export const homeTeamRelations = relations(homeTeam, ({many}) => ({
	sportsEvents: many(sportsEvent),
}));

export const cableBoxRelations = relations(cableBox, ({one}) => ({
	cecDevice: one(cecDevice, {
		fields: [cableBox.cecDeviceId],
		references: [cecDevice.id]
	}),
}));

export const cecDeviceRelations = relations(cecDevice, ({many}) => ({
	cableBoxes: many(cableBox),
	cecCommandLogs: many(cecCommandLog),
}));

export const cecCommandLogRelations = relations(cecCommandLog, ({one}) => ({
	cecDevice: one(cecDevice, {
		fields: [cecCommandLog.cecDeviceId],
		references: [cecDevice.id]
	}),
}));