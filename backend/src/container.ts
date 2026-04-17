import { ClaudeService } from './services/ClaudeService'
import { GeminiService } from './services/GeminiService'
import { PerplexityService } from './services/PerplexityService'
import { ExtractionService } from './services/ExtractionService'
import { ScraperRegistry } from './scrapers/ScraperRegistry'
import { CompetitorService } from './services/CompetitorService'
import { AdsService } from './services/AdsService'
import { AdsController } from './controllers/AdsController'
import { AnalysisController } from './controllers/AnalysisController'
import { CompetitorsController } from './controllers/CompetitorsController'

// Leaves (no dependencies)
const claudeService = new ClaudeService()
const geminiService = new GeminiService()
const perplexityService = new PerplexityService()
const scraperRegistry = new ScraperRegistry()

// Branches
const extractionService = new ExtractionService(claudeService)
const competitorService = new CompetitorService(perplexityService, claudeService)
const adsService = new AdsService(scraperRegistry, extractionService)

// Controllers
export const adsController = new AdsController(adsService)
export const analysisController = new AnalysisController(claudeService, geminiService)
export const competitorsController = new CompetitorsController(competitorService)
