import { ClaudeService } from './services/ClaudeService.ts'
import { PerplexityService } from './services/PerplexityService.ts'
import { ExtractionService } from './services/ExtractionService.ts'
import { ScraperRegistry } from './scrapers/ScraperRegistry.ts'
import { CompetitorService } from './services/CompetitorService.ts'
import { AdsService } from './services/AdsService.ts'
import { AdsController } from './controllers/AdsController.ts'
import { AnalysisController } from './controllers/AnalysisController.ts'
import { CompetitorsController } from './controllers/CompetitorsController.ts'

// Leaves (no dependencies)
const claudeService = new ClaudeService()
const perplexityService = new PerplexityService()
const scraperRegistry = new ScraperRegistry()

// Branches
const extractionService = new ExtractionService(claudeService)
const competitorService = new CompetitorService(perplexityService, claudeService)
const adsService = new AdsService(scraperRegistry, extractionService)

// Controllers
export const adsController = new AdsController(adsService)
export const analysisController = new AnalysisController(claudeService)
export const competitorsController = new CompetitorsController(competitorService)
